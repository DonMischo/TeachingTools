"""Playhub: einen Beitrittscode ohne Werkzeugnamen auflösen.

Sitzungen werden direkt über die db-Fixture angelegt — /api/play/resolve ist
bewusst öffentlich, ein Login soll für den Beitritt nicht nötig sein.
"""
import random

from api.join_codes import JOIN_CODE_TOOLS, code_taken
from api.models import ExitTicketSession, SchreibraumRoom, ToolSession, WettschreibenSession
from api.utils import gen_code


def _exit_ticket(db, teacher, code="ET0001"):
    s = ExitTicketSession(code=code, title="T", question="Q?", created_by=teacher.id)
    db.add(s); db.flush()
    return s


def _schreibraum(db, teacher, code="SR0001"):
    r = SchreibraumRoom(code=code, title="Raum", created_by=teacher.id)
    db.add(r); db.flush()
    return r


def _tool_session(db, teacher, code="TS0001"):
    s = ToolSession(code=code, tool_slug="abacus", created_by=teacher.id)
    db.add(s); db.flush()
    return s


def _wettschreiben(db, teacher, code="WS0001"):
    s = WettschreibenSession(code=code, title="Rennen", text="abc", created_by=teacher.id)
    db.add(s); db.flush()
    return s


# ── Registry ────────────────────────────────────────────────────────────────

def test_registry_entries_are_wellformed():
    for tool in JOIN_CODE_TOOLS:
        assert hasattr(tool.model, tool.column), f"{tool.key}: Spalte {tool.column} fehlt"
        assert "{code}" in tool.play_path, f"{tool.key}: play_path ohne Code"
        assert tool.avatar in ("none", "guests", "always"), f"{tool.key}: {tool.avatar}?"
    keys = [t.key for t in JOIN_CODE_TOOLS]
    assert len(keys) == len(set(keys))


# ── Auflösen ────────────────────────────────────────────────────────────────

def test_resolves_exit_ticket(client, db, teacher):
    _exit_ticket(db, teacher)
    r = client.get("/api/play/resolve/ET0001")
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == "ET0001"
    assert body["matches"] == [{
        "tool": "exit-ticket", "label": "🎫 Exit Ticket", "code": "ET0001",
        "join_url": "/play/exit-ticket/ET0001", "status": "open", "avatar": "none",
        "anonymous": False,
    }]


def test_resolves_tool_without_status_column(client, db, teacher):
    _schreibraum(db, teacher)
    m = client.get("/api/play/resolve/SR0001").json()["matches"][0]
    assert m["tool"] == "schreibraum"
    assert m["join_url"] == "/schreibraum/SR0001"
    assert m["status"] is None


def test_resolves_stateless_simulation(client, db, teacher):
    _tool_session(db, teacher)
    m = client.get("/api/play/resolve/TS0001").json()["matches"][0]
    assert m["tool"] == "simulation"
    assert m["join_url"] == "/play/simulation/TS0001"


def test_code_is_normalized(client, db, teacher):
    _wettschreiben(db, teacher)
    r = client.get("/api/play/resolve/ws-0001")
    assert r.status_code == 200
    assert r.json()["matches"][0]["join_url"] == "/play/wettschreiben/WS0001"


def test_avatar_policy_is_the_one_the_hub_relies_on():
    """Der Hub blendet die Avatarwahl allein anhand dieses Feldes ein.

    "always" = auch Angemeldete waehlen (Name bleibt gesperrt), "guests" = nur
    Gaeste, "none" = das Werkzeug verwirft den Avatar ohnehin.
    """
    policy = {t.key: t.avatar for t in JOIN_CODE_TOOLS}
    assert policy["caputh"] == "always"
    assert policy["lueckentext"] == "always"
    assert policy["bingo"] == "guests"
    assert all(policy[k] == "none" for k in
               ("exit-ticket", "barometer", "auction", "exitgame",
                "schreibraum", "wettschreiben", "simulation"))


def test_unknown_code_404(client, db, teacher):
    assert client.get("/api/play/resolve/NOPE12").status_code == 404


def test_code_shared_by_two_tools_returns_both(client, db, teacher):
    """Codes sind nur pro Tabelle eindeutig — Altbestände können kollidieren."""
    _exit_ticket(db, teacher, code="DOPPEL")
    _tool_session(db, teacher, code="DOPPEL")
    matches = client.get("/api/play/resolve/DOPPEL").json()["matches"]
    assert {m["tool"] for m in matches} == {"exit-ticket", "simulation"}


# ── Globale Eindeutigkeit neuer Codes ───────────────────────────────────────

def test_code_taken_sees_other_tools(db, teacher):
    _exit_ticket(db, teacher, code="ABC123")
    assert code_taken(db, "ABC123")
    assert not code_taken(db, "ZZZ999")


def test_gen_code_skips_a_code_another_tool_uses(db, teacher, monkeypatch):
    _exit_ticket(db, teacher, code="ABC123")
    codes = iter(["ABC123", "XYZ789"])
    monkeypatch.setattr(random, "choices", lambda chars, k: list(next(codes)))
    # Fragt nach einem Wettschreiben-Code; ABC123 ist dort frei, aber vergeben.
    assert gen_code(db, WettschreibenSession) == "XYZ789"


# ── Sitzungsuebersicht: auflisten, schliessen, wieder oeffnen ───────────────

def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_lists_only_my_own_sessions(client, db, teacher, admin, teacher_token):
    _exit_ticket(db, teacher, code="MINE01")
    _exit_ticket(db, admin, code="THEIR1")

    rows = client.get("/api/play/sessions?tool=exit-ticket", headers=_auth(teacher_token)).json()
    assert [r["code"] for r in rows] == ["MINE01"]
    assert rows[0]["mine"] is True


def test_admin_sees_every_session(client, db, teacher, admin, admin_token):
    _exit_ticket(db, teacher, code="MINE01")
    _exit_ticket(db, admin, code="THEIR1")

    rows = client.get("/api/play/sessions?tool=exit-ticket", headers=_auth(admin_token)).json()
    assert {r["code"] for r in rows} == {"MINE01", "THEIR1"}
    # Fremde Sitzungen sind als solche erkennbar.
    assert {r["code"]: r["mine"] for r in rows} == {"MINE01": False, "THEIR1": True}


def test_close_and_reopen_keep_the_code(client, db, teacher, teacher_token):
    _exit_ticket(db, teacher, code="MINE01")

    closed = client.post("/api/play/sessions/MINE01/close?tool=exit-ticket", headers=_auth(teacher_token))
    assert closed.status_code == 200
    assert closed.json()["closed"] is True and closed.json()["status"] == "closed"

    reopened = client.post("/api/play/sessions/MINE01/reopen?tool=exit-ticket", headers=_auth(teacher_token))
    assert reopened.json()["closed"] is False and reopened.json()["status"] == "open"
    # Derselbe Code — ein gedruckter QR funktioniert weiter.
    assert reopened.json()["code"] == "MINE01"


def test_cannot_close_someone_elses_session(client, db, teacher, admin, teacher_token):
    _exit_ticket(db, admin, code="THEIR1")
    r = client.post("/api/play/sessions/THEIR1/close?tool=exit-ticket", headers=_auth(teacher_token))
    assert r.status_code == 403


def test_guests_are_turned_away_while_closed(client, db, teacher, teacher_token):
    s = _exit_ticket(db, teacher, code="MINE01")
    s.allow_guests = True
    db.flush()

    client.post("/api/play/sessions/MINE01/close?tool=exit-ticket", headers=_auth(teacher_token))
    client.cookies.clear()
    blocked = client.post("/api/guest/join", json={"code": "MINE01", "tool": "exit-ticket", "name": "Bob"})
    assert blocked.status_code == 403

    client.post("/api/play/sessions/MINE01/reopen?tool=exit-ticket", headers=_auth(teacher_token))
    client.cookies.clear()
    assert client.post("/api/guest/join", json={"code": "MINE01", "tool": "exit-ticket", "name": "Bob"}).status_code == 200


def test_gameplay_tools_keep_their_own_endpoints(client, db, teacher, teacher_token):
    """Bingo verteilt beim Schliessen Punkte — das darf nicht generisch passieren."""
    r = client.post("/api/play/sessions/WHATEVER/close?tool=bingo", headers=_auth(teacher_token))
    assert r.status_code == 400


# ── Zustandslose Werkzeuge: je Werkzeug und Inhalt eine Sitzung ─────────────

def test_slug_narrows_the_stateless_tools(client, db, teacher, teacher_token):
    """Abakus, Tippen und Zeitstrahl teilen sich ein Modell — der Slug trennt sie."""
    db.add(ToolSession(code="TIP001", tool_slug="tippen", created_by=teacher.id))
    db.add(ToolSession(code="ABA001", tool_slug="abacus", created_by=teacher.id))
    db.flush()

    rows = client.get("/api/play/sessions?tool=simulation&slug=tippen",
                      headers=_auth(teacher_token)).json()
    assert [r["code"] for r in rows] == ["TIP001"]
    assert rows[0]["tool_slug"] == "tippen"


def test_zeitstrahl_shares_one_timeline_per_session(client, db, teacher, teacher_token):
    from api.models import TimelineSet
    a = TimelineSet(title="Rom", axis={}, created_by=teacher.id)
    b = TimelineSet(title="Mittelalter", axis={}, created_by=teacher.id)
    db.add_all([a, b]); db.flush()

    first = client.post("/api/tool-sessions", json={"tool_slug": "zeitstrahl", "ref_id": a.id},
                        headers=_auth(teacher_token))
    assert first.status_code == 201
    assert first.json()["ref_id"] == a.id
    assert first.json()["ref_title"] == "Rom"

    # Dieselbe Zeitleiste -> derselbe Code (ein gedruckter QR bleibt gueltig).
    again = client.post("/api/tool-sessions", json={"tool_slug": "zeitstrahl", "ref_id": a.id},
                        headers=_auth(teacher_token))
    assert again.json()["code"] == first.json()["code"]

    # Eine andere Zeitleiste -> eigener Code.
    other = client.post("/api/tool-sessions", json={"tool_slug": "zeitstrahl", "ref_id": b.id},
                        headers=_auth(teacher_token))
    assert other.json()["code"] != first.json()["code"]


def test_zeitstrahl_needs_a_timeline(client, db, teacher, teacher_token):
    r = client.post("/api/tool-sessions", json={"tool_slug": "zeitstrahl"},
                    headers=_auth(teacher_token))
    assert r.status_code == 422


def test_stateless_tools_without_content_ignore_ref_id(client, db, teacher, teacher_token):
    r = client.post("/api/tool-sessions", json={"tool_slug": "abacus", "ref_id": 99},
                    headers=_auth(teacher_token))
    assert r.status_code == 201 and r.json()["ref_id"] is None


# ── Pinnwände (Fragmente) ───────────────────────────────────────────────────

def _pinnwand(db, teacher, code="PW0001", allow=True):
    from api.models import FragmentCollection
    c = FragmentCollection(name="Wand", owner_teacher_id=teacher.id, guest_code=code, allow_guests=allow)
    db.add(c); db.flush()
    return c


def test_resolves_pinnwand_guest_code(client, db, teacher):
    _pinnwand(db, teacher)
    r = client.get("/api/play/resolve/pw-0001")
    assert r.status_code == 200
    (m,) = r.json()["matches"]
    assert m["tool"] == "fragmente"
    assert m["join_url"] == "/fragmente/join?code=PW0001"
    assert code_taken(db, "PW0001")


def test_hub_guest_join_respects_pinnwand_opt_in(client, db, teacher):
    _pinnwand(db, teacher, code="PW0002", allow=False)
    r = client.post("/api/guest/join", json={"tool": "fragmente", "code": "PW0002", "name": "Gast"})
    assert r.status_code == 403
    _pinnwand(db, teacher, code="PW0003")
    r = client.post("/api/guest/join", json={"tool": "fragmente", "code": "PW0003", "name": "Gast"})
    assert r.status_code == 200
