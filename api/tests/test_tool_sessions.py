"""Join sessions for the stateless tools (Abakus, Gleichungswaage, Bildformate) + guest opt-in."""
from api.models import ToolAvailability, ToolSession
from api.tests.conftest import auth


def _create(client, token, slug="gleichungswaage"):
    return client.post("/api/tool-sessions", json={"tool_slug": slug}, headers=auth(token))


# ── anlegen ──────────────────────────────────────────────────────────────────

def test_create_returns_a_code(client, teacher_token):
    r = _create(client, teacher_token)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["tool_slug"] == "gleichungswaage"
    assert len(body["code"]) >= 4
    assert body["allow_guests"] is False  # Gäste sind erst nach Opt-in drin


def test_same_teacher_and_tool_keeps_one_code(client, teacher_token):
    first = _create(client, teacher_token).json()["code"]
    second = _create(client, teacher_token).json()["code"]
    assert first == second  # ein gedruckter QR bleibt gültig


def test_each_tool_has_its_own_session(client, teacher_token):
    codes = {
        slug: _create(client, teacher_token, slug).json()["code"]
        for slug in ("gleichungswaage", "abacus", "bildformate")
    }
    assert len(set(codes.values())) == 3


def test_every_joinable_tool_can_open_a_session(client, teacher_token):
    """Ein Werkzeug in SESSION_TOOLS muss auch im Katalog stehen und einen Code
    bekommen — sonst zeigt die Werkzeugseite einen QR-Knopf, der 400 liefert."""
    from api.routers.tool_sessions import SESSION_TOOLS
    from api.tool_catalog import BY_SLUG

    from api.routers.tool_sessions import REF_TOOLS

    codes = set()
    for slug in SESSION_TOOLS:
        assert slug in BY_SLUG, f"{slug} fehlt im tool_catalog"
        r = _create(client, teacher_token, slug)
        if slug in REF_TOOLS:
            # Der Zeitstrahl teilt eine bestimmte Zeitleiste — ohne ref_id
            # gibt es nichts zu teilen, und der Code bleibt aus.
            assert r.status_code == 422, f"{slug}: {r.text}"
            continue
        assert r.status_code == 201, f"{slug}: {r.text}"
        codes.add(r.json()["code"])
    # Jedes Werkzeug hat seinen eigenen Code, nicht einen gemeinsamen.
    assert len(codes) == len([s for s in SESSION_TOOLS if s not in REF_TOOLS])


def test_unknown_or_unsupported_tool_is_refused(client, teacher_token):
    assert _create(client, teacher_token, "caputh").status_code == 400
    assert _create(client, teacher_token, "gibtsnicht").status_code == 400


def test_creating_needs_a_login(client):
    assert client.post("/api/tool-sessions", json={"tool_slug": "abacus"}).status_code in (401, 403)


def test_blocked_tool_cannot_be_hosted(client, db, teacher, teacher_token):
    db.add(ToolAvailability(tool_slug="abacus", capability="use", audience="teacher",
                            class_id=None, allowed=False))
    db.flush()
    assert _create(client, teacher_token, "abacus").status_code == 403


# ── beitreten ────────────────────────────────────────────────────────────────

def test_lookup_is_public_and_says_which_tool(client, teacher_token):
    code = _create(client, teacher_token, "abacus").json()["code"]
    r = client.get(f"/api/tool-sessions/{code}")  # ohne Login
    assert r.status_code == 200
    # Abakus teilt keinen Inhalt — ref_id/ref_title bleiben leer, anders als
    # beim Zeitstrahl, der immer eine bestimmte Zeitleiste teilt.
    assert r.json() == {
        "code": code, "tool_slug": "abacus", "allow_guests": False,
        "status": "open", "ref_id": None, "ref_title": None, "settings": {},
    }


def test_lookup_of_an_unknown_code_is_404(client):
    assert client.get("/api/tool-sessions/ZZZZZZ").status_code == 404


# ── Gäste ────────────────────────────────────────────────────────────────────

def test_guest_join_is_refused_until_the_teacher_opts_in(client, teacher_token):
    code = _create(client, teacher_token).json()["code"]
    r = client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": "Gast"})
    assert r.status_code == 403


def test_guest_join_works_after_opt_in(client, teacher_token):
    code = _create(client, teacher_token).json()["code"]

    allow = client.patch("/api/guest/allow",
                         json={"code": code, "tool": "simulation", "allow": True},
                         headers=auth(teacher_token))
    assert allow.status_code == 200 and allow.json()["allow_guests"] is True

    # Der Beitritts-Screen sieht die Freigabe ohne Login.
    assert client.get("/api/guest/status", params={"tool": "simulation", "code": code}).json() == {
        "allow_guests": True, "guest_epoch": 0, "guest_minutes": 90,
        # Frisch freigeschaltet: das Gastfenster laeuft die volle Zeit.
        "guest_minutes_left": 90,
    }
    assert client.get(f"/api/tool-sessions/{code}").json()["allow_guests"] is True

    joined = client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": "Mia"})
    assert joined.status_code == 200
    assert joined.json()["name"] == "Mia"
    assert joined.json()["token"]


def test_guest_token_is_bound_to_this_session(client, teacher_token, db):
    from api.auth import decode_guest_token

    code = _create(client, teacher_token).json()["code"]
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True},
                 headers=auth(teacher_token))
    token = client.post("/api/guest/join",
                        json={"code": code, "tool": "simulation", "name": "Mia"}).json()["token"]

    assert decode_guest_token(token, code) is not None
    assert decode_guest_token(token, "ANDERS") is None


def test_opt_in_is_stored_on_the_session(client, db, teacher_token):
    code = _create(client, teacher_token).json()["code"]
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True},
                 headers=auth(teacher_token))
    assert db.query(ToolSession).filter_by(code=code).first().allow_guests is True


# ── Einstellungen der Lehrkraft ──────────────────────────────────────────────

def test_teacher_settings_are_stored_and_public(client, teacher_token):
    code = _create(client, teacher_token, "leviathan").json()["code"]
    einst = {"krise": "zusammenbruch", "runden": 10, "sichtbar": False, "aus": ["krieg"], "drehbuch": []}
    r = client.put(f"/api/tool-sessions/{code}/settings", json=einst, headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    # Der Beitritts-Screen liest sie ohne Anmeldung mit.
    assert client.get(f"/api/tool-sessions/{code}").json()["settings"] == einst


def test_new_session_has_empty_settings(client, teacher_token):
    assert _create(client, teacher_token, "leviathan").json()["settings"] == {}


def test_only_the_owner_changes_settings(client, teacher_token, admin_token):
    # Im TestClient schlägt das Login-Cookie den Bearer-Header – also leeren.
    client.cookies.clear()
    code = _create(client, teacher_token, "leviathan").json()["code"]
    r = client.put(f"/api/tool-sessions/{code}/settings", json={"krise": "ruhig"}, headers=auth(admin_token))
    assert r.status_code == 403
    assert client.put(f"/api/tool-sessions/{code}/settings", json={"krise": "ruhig"}).status_code in (401, 403)


def test_oversized_settings_are_refused(client, teacher_token):
    code = _create(client, teacher_token, "leviathan").json()["code"]
    r = client.put(f"/api/tool-sessions/{code}/settings", json={"x": "a" * 5000}, headers=auth(teacher_token))
    assert r.status_code == 413
