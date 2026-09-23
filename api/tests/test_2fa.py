"""Zwei-Faktor: Einrichtung, Step-up und die beiden Stellen, die daran haengen.

Die Kryptografie selbst kommt aus dem Werkstatt-Tool und hat dort eigene Tests;
hier geht es um die Verdrahtung — wer ohne zweiten Faktor woran nicht kommt.
"""
import pyotp
import pytest

from api import totp as totp_lib
from api.auth import create_access_token, hash_password
from api.models import AuditLog, Student, Teacher
from api.tests.conftest import auth

PREFIX = "/api/2fa"


def _head(t: Teacher) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': str(t.id), 'type': 'teacher'})}"}


def _code(secret: str, at: int = 0) -> str:
    """Ein gerade gueltiger Code; `at` verschiebt um ganze 30-Sekunden-Schritte."""
    return pyotp.TOTP(secret).at((totp_lib.current_counter() + at) * totp_lib.STEP_SECONDS)


@pytest.fixture()
def admin2(db):
    t = Teacher(first_name="Ada", last_name="Admin", active=True, role="admin",
                username="a.admin", password_hash=hash_password("geheim"))
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def opfer(db):
    """Die Lehrkraft, deren Passwort abgerufen wird."""
    from api.pw_crypto import encrypt
    t = Teacher(first_name="Bo", last_name="Bekannt", active=True, role="teacher",
                username="b.bekannt", password_hash=hash_password("abc"),
                password_enc=encrypt("Sonnenblume42!"))
    db.add(t)
    db.flush()
    return t


def _einrichten(client, t: Teacher) -> str:
    """Zwei-Faktor fuer `t` scharf schalten; gibt das Geheimnis zurueck."""
    client.cookies.clear()
    r = client.post(f"{PREFIX}/setup", headers=_head(t))
    assert r.status_code == 200, r.text
    secret = r.json()["secret"]
    r = client.post(f"{PREFIX}/activate", json={"code": _code(secret)}, headers=_head(t))
    assert r.status_code == 200, r.text
    return secret


# ── Einrichtung ─────────────────────────────────────────────────────────────

class TestEinrichtung:
    def test_status_faengt_bei_aus_an(self, client, admin2):
        client.cookies.clear()
        r = client.get(f"{PREFIX}/status", headers=_head(admin2))
        assert r.json() == {"confirmed": False, "recovery_left": 0}

    def test_setup_liefert_geheimnis_und_qr(self, client, admin2):
        client.cookies.clear()
        r = client.post(f"{PREFIX}/setup", headers=_head(admin2))
        assert r.status_code == 200
        body = r.json()
        assert body["otpauth_uri"].startswith("otpauth://totp/")
        assert "Teaching" in body["otpauth_uri"]
        assert "<svg" in body["qr_svg"]

    def test_erst_der_richtige_code_schaltet_scharf(self, client, db, admin2):
        client.cookies.clear()
        secret = client.post(f"{PREFIX}/setup", headers=_head(admin2)).json()["secret"]
        assert client.post(f"{PREFIX}/activate", json={"code": "000000"},
                           headers=_head(admin2)).status_code == 400
        db.refresh(admin2)
        assert admin2.totp_confirmed is False   # abgebrochen sperrt niemanden aus

        r = client.post(f"{PREFIX}/activate", json={"code": _code(secret)}, headers=_head(admin2))
        assert r.status_code == 200
        assert len(r.json()["recovery_codes"]) == totp_lib.RECOVERY_CODE_COUNT
        db.refresh(admin2)
        assert admin2.totp_confirmed is True

    def test_abschalten_geht_nur_mit_dem_eigenen_passwort(self, client, db, admin2):
        _einrichten(client, admin2)
        assert client.post(f"{PREFIX}/disable", json={"password": "falsch"},
                           headers=_head(admin2)).status_code == 403
        assert client.post(f"{PREFIX}/disable", json={"password": "geheim"},
                           headers=_head(admin2)).status_code == 204
        db.refresh(admin2)
        assert admin2.totp_confirmed is False and admin2.totp_secret is None

    def test_wiederherstellungscode_gilt_einmal(self, client, db, admin2):
        client.cookies.clear()
        secret = client.post(f"{PREFIX}/setup", headers=_head(admin2)).json()["secret"]
        codes = client.post(f"{PREFIX}/activate", json={"code": _code(secret)},
                            headers=_head(admin2)).json()["recovery_codes"]

        assert client.post(f"{PREFIX}/recovery", json={"code": codes[0]},
                           headers=_head(admin2)).status_code == 200
        db.refresh(admin2)
        assert admin2.totp_confirmed is False
        # Derselbe Code ein zweites Mal: nein.
        assert client.post(f"{PREFIX}/recovery", json={"code": codes[0]},
                           headers=_head(admin2)).status_code == 403


# ── Step-up: das Passwort einer Lehrkraft ansehen ───────────────────────────

class TestPasswortEinsehen:
    def test_ohne_zweiten_faktor_kein_zugriff(self, client, admin2, opfer):
        client.cookies.clear()
        r = client.post(f"/api/teachers/{opfer.id}/password", json={"code": "123456"},
                        headers=_head(admin2))
        assert r.status_code == 403
        assert "Zwei-Faktor" in r.json()["detail"]

    def test_mit_frischem_code_kommt_das_passwort(self, client, admin2, opfer):
        secret = _einrichten(client, admin2)
        r = client.post(f"/api/teachers/{opfer.id}/password",
                        json={"code": _code(secret, at=1)}, headers=_head(admin2))
        assert r.status_code == 200, r.text
        assert r.json()["password"] == "Sonnenblume42!"
        assert r.json()["username"] == "b.bekannt"

    def test_derselbe_code_geht_kein_zweites_mal(self, client, admin2, opfer):
        """Sonst waere ein abgefangener Code in seinen 30 Sekunden beliebig oft
        brauchbar — genau das verhindert totp_last_counter."""
        secret = _einrichten(client, admin2)
        code = _code(secret, at=1)
        assert client.post(f"/api/teachers/{opfer.id}/password", json={"code": code},
                           headers=_head(admin2)).status_code == 200
        assert client.post(f"/api/teachers/{opfer.id}/password", json={"code": code},
                           headers=_head(admin2)).status_code == 403

    def test_eine_lehrkraft_mit_2fa_darf_es_trotzdem_nicht(self, client, db, teacher, opfer):
        """Der zweite Faktor ersetzt die Rolle nicht — Einzelabruf bleibt Admin."""
        secret = _einrichten(client, teacher)
        r = client.post(f"/api/teachers/{opfer.id}/password",
                        json={"code": _code(secret, at=1)}, headers=_head(teacher))
        assert r.status_code == 403

    def test_der_abruf_steht_im_protokoll(self, client, db, admin2, opfer):
        secret = _einrichten(client, admin2)
        client.post(f"/api/teachers/{opfer.id}/password", json={"code": _code(secret, at=1)},
                    headers=_head(admin2))
        zeile = db.query(AuditLog).filter_by(action="teachers.password.reveal").first()
        assert zeile is not None
        assert zeile.actor == "a.admin"
        assert zeile.target == "b.bekannt"

    def test_raten_wird_gebremst(self, client, admin2, opfer):
        """Sechs Stellen sind eine Million Moeglichkeiten — ohne Bremse waere
        Durchprobieren mit genug Anfragen pro Minute eine reale Option."""
        from api.routers.twofa import MAX_FEHLVERSUCHE, _FEHLVERSUCHE
        _FEHLVERSUCHE.clear()
        _einrichten(client, admin2)
        for _ in range(MAX_FEHLVERSUCHE):
            r = client.post(f"/api/teachers/{opfer.id}/password", json={"code": "000000"},
                            headers=_head(admin2))
            assert r.status_code == 403
        r = client.post(f"/api/teachers/{opfer.id}/password", json={"code": "000000"},
                        headers=_head(admin2))
        assert r.status_code == 429
        _FEHLVERSUCHE.clear()

    def test_ein_richtiger_code_setzt_die_bremse_zurueck(self, client, admin2, opfer):
        from api.routers.twofa import _FEHLVERSUCHE
        _FEHLVERSUCHE.clear()
        secret = _einrichten(client, admin2)
        client.post(f"/api/teachers/{opfer.id}/password", json={"code": "000000"},
                    headers=_head(admin2))
        assert client.post(f"/api/teachers/{opfer.id}/password",
                           json={"code": _code(secret, at=1)},
                           headers=_head(admin2)).status_code == 200
        assert _FEHLVERSUCHE.get(admin2.id) in (None, [])

    def test_der_sammelexport_ist_weg(self, client, admin_token):
        assert client.get("/api/teachers/credentials/download",
                          headers=auth(admin_token)).status_code == 404


# ── Voraussetzung: Klassenleitung exportiert nur mit eingerichtetem 2FA ─────

class TestKlassenleitungBrauchtZweiFaktor:
    @pytest.fixture()
    def klassenlehrer(self, db, klass):
        t = Teacher(first_name="Kim", last_name="Klassen", active=True, role="teacher",
                    klasse_id=klass.id, username="k.klassen",
                    password_hash=hash_password("x"))
        db.add(t)
        db.add(Student(nachname="Aal", vorname="Anna", klasse=klass.code,
                       class_id=klass.id, username="a.aal10", active=True))
        db.flush()
        return t

    def test_ohne_zweiten_faktor_kein_export(self, client, klassenlehrer):
        client.cookies.clear()
        r = client.get("/api/students/credentials/download", headers=_head(klassenlehrer))
        assert r.status_code == 403
        assert "Zwei-Faktor" in r.json()["detail"]

    def test_mit_eingerichtetem_zweiten_faktor_schon(self, client, klassenlehrer):
        _einrichten(client, klassenlehrer)
        r = client.get("/api/students/credentials/download", headers=_head(klassenlehrer))
        assert r.status_code == 200
        assert "Aal" in r.text

    def test_der_admin_braucht_dafuer_keinen(self, client, admin_token, klassenlehrer):
        """Bewusste Asymmetrie: der zweite Faktor ist der Preis dafuer, dass die
        Klassenleitung ueberhaupt an Klarpasswoerter kommt."""
        assert client.get("/api/students/credentials/download",
                          headers=auth(admin_token)).status_code == 200
