"""Challenge je Klasse bzw. Kurs: eigener Code je Geltungsbereich, nur diese
Klasse darf herein, Gäste zählen für sie, Punkte gibt es nur für sie."""
from api.models import Class, StudentGroup, StudentGroupMember

from .conftest import auth
from .test_challenge import ETAPPE_1, _antwort, _gast, _h, _schueler, _start, _tok, _upload


def _klasse(db, code):
    c = Class(code=code, display_name=f"Klasse {code}")
    db.add(c); db.flush()
    return c


def _code(client, token, sid, **scope):
    r = client.post("/api/tool-sessions", json={"tool_slug": "challenge", "ref_id": sid, **scope}, headers=_h(client, token))
    assert r.status_code == 201, r.text
    return r.json()


def test_je_klasse_ein_eigener_code(client, db, teacher_token, klass):
    andere = _klasse(db, "5b")
    sid = _upload(client, teacher_token).json()["id"]
    a = _code(client, teacher_token, sid, class_id=klass.id)
    b = _code(client, teacher_token, sid, class_id=andere.id)
    assert a["code"] != b["code"]
    assert _code(client, teacher_token, sid, class_id=klass.id)["code"] == a["code"]  # stabil je Klasse
    assert a["scope_label"] == "5a" and a["class_id"] == klass.id
    r = client.post("/api/tool-sessions", json={"tool_slug": "challenge", "ref_id": sid, "class_id": klass.id, "group_id": 1},
                    headers=_h(client, teacher_token))
    assert r.status_code == 422


def test_nur_die_eigene_klasse_darf_herein(client, db, teacher_token, klass):
    andere = _klasse(db, "5b")
    sid = _upload(client, teacher_token).json()["id"]
    code = _code(client, teacher_token, sid, class_id=klass.id)["code"]
    drin, fremd = _schueler(db, klass), _schueler(db, andere, "Ole")
    assert _start(client, code, _tok(drin)).status_code == 200
    assert _start(client, code, _tok(fremd)).status_code == 403
    assert client.get(f"/api/challenge/{code}", headers=_h(client, _tok(fremd))).status_code == 403
    assert _start(client, code, teacher_token).status_code == 200  # Lehrkraft spielt mit


def test_kurs_laesst_nur_mitglieder_herein(client, db, teacher_token, klass):
    kurs = StudentGroup(name="NaT", group_type="kurs", grade="5")
    db.add(kurs); db.flush()
    mitglied, draussen = _schueler(db, klass), _schueler(db, klass, "Ole")
    db.add(StudentGroupMember(group_id=kurs.id, student_id=mitglied.id)); db.flush()
    sid = _upload(client, teacher_token).json()["id"]
    code = _code(client, teacher_token, sid, group_id=kurs.id)["code"]
    assert _start(client, code, _tok(mitglied)).status_code == 200
    assert _start(client, code, _tok(draussen)).status_code == 403


def test_gaeste_zaehlen_fuer_die_klasse_und_punkte_nur_fuer_sie(client, db, teacher_token, klass):
    andere = _klasse(db, "5b")
    sid = _upload(client, teacher_token).json()["id"]
    code = _code(client, teacher_token, sid, class_id=klass.id)["code"]
    gast = _gast(client, teacher_token, code)
    _start(client, code, gast)
    for cid in ETAPPE_1:
        _antwort(client, code, gast, cid)
    ueb = client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()
    assert [t["klasse"] for t in ueb["teilnehmer"]] == ["5a (Gast)"]
    assert [p["klasse"] for p in ueb["punkte"]] == ["5a"]
    # Ein Stand aus einer fremden Klasse (z. B. aus der Zeit vor der Bindung) bekommt nichts
    from api.models import ChallengeStand
    st = db.query(ChallengeStand).first()
    st.class_id = andere.id; db.flush()
    ueb = client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()
    assert ueb["punkte"] == []


def test_ohne_klasse_bleibt_die_alte_offene_sitzung(client, db, teacher_token, klass):
    sid = _upload(client, teacher_token).json()["id"]
    offen = _code(client, teacher_token, sid)
    assert offen["scope_label"] is None
    gast = _gast(client, teacher_token, offen["code"])
    _start(client, offen["code"], gast)
    ueb = client.get(f"/api/challenge/{offen['code']}/uebersicht", headers=_h(client, teacher_token)).json()
    assert [t["klasse"] for t in ueb["teilnehmer"]] == ["Gast"] and ueb["punkte"] == []
