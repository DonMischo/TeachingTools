"""Workshop-Instanz befüllen: Moderations-Admin, Teilnehmer-Zugänge, Beispielinhalte
und die erfundene Schülerliste data/workshop/schueler.csv (5a–10c).

Nur für die Übungsinstanz aus workshop/workshop.bat gedacht (eigene Datenbank, erfundene
Daten), nie für eine Schulinstanz. Läuft im API-Container:

    python -m api.workshop_seed [--anzahl 30] [--url https://….trycloudflare.com]

Mehrfach aufrufbar: vorhandene Zugänge bleiben, Beispiele werden nur einmal
hochgeladen. Die Zugangsliste landet in data/zugaenge.txt (bei der
Workshop-Instanz also in workshop/instanz/data/, nicht im Repo).
"""
import argparse
import json
import secrets
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from .auth import hash_password
from .database import SessionLocal
from .models import Student, Teacher
from .password_gen import generate_password

DATA = Path(__file__).parent.parent / "data"
ZUGAENGE = DATA / "zugaenge.txt"
MARKER = DATA / ".workshop-beispiele"
SCHUELER = DATA / "workshop" / "schueler.csv"
API = "http://127.0.0.1:8000"

BEISPIELE = [
    ("/api/timelines/upload", "timeline_examples/Timeline_MBI_Media.json"),
    ("/api/timelines/upload", "timeline_examples/antike.json"),
    ("/api/timelines/upload", "timeline_examples/erdgeschichte.json"),
    ("/api/challenge/upload", "challenge_examples/Geschichte_der_Medien.json"),
    ("/api/exitgames/upload", "taskcrawler_examples/TaskCrawler_Geschichte_der_Medien.json"),
    ("/api/exitgames/upload", "taskcrawler_examples/TaskCrawler_Gleichungen_Klasse7_v2.json"),
]


def _zugang(db, username: str, role: str, vorname: str, nachname: str) -> str | None:
    """Legt den Zugang an und gibt das Passwort zurück; None, wenn es ihn schon gab."""
    if db.query(Teacher).filter(Teacher.username == username).first():
        return None
    seed = secrets.randbelow(10**9)
    pw = generate_password(seed)
    db.add(Teacher(first_name=vorname, last_name=nachname, username=username, role=role,
                   active=True, password_hash=hash_password(pw), password_seed=seed))
    return pw


def _hochladen(token: str, pfad: str, datei: Path, typ: str = "application/json") -> dict:
    grenze = uuid.uuid4().hex
    body = (f"--{grenze}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{datei.name}\"\r\n"
            f"Content-Type: {typ}\r\n\r\n").encode() + datei.read_bytes() + f"\r\n--{grenze}--\r\n".encode()
    req = urllib.request.Request(API + pfad, data=body, method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": f"multipart/form-data; boundary={grenze}"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


def _schueler_importieren(token: str) -> int:
    """Wie im Admin-Bereich: Vorschau holen, dann alle neuen Zeilen übernehmen."""
    diff = _hochladen(token, "/api/students/preview", SCHUELER, "text/csv")["diff"]
    body = {"mode": "roster", "selected_keys": [d["key"] for d in diff],
            "csv_data": {d["key"]: d["csv_data"] for d in diff}}
    req = urllib.request.Request(API + "/api/students/apply", data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())["applied"]


def _login(username: str, pw: str) -> str:
    req = urllib.request.Request(API + "/api/auth/login", method="POST",
                                 data=json.dumps({"username": username, "password": pw}).encode(),
                                 headers={"Content-Type": "application/json"})
    for _ in range(60):  # die API startet evtl. gerade noch
        try:
            return json.loads(urllib.request.urlopen(req, timeout=10).read())["access_token"]
        except OSError:
            time.sleep(2)
    raise SystemExit("API nicht erreichbar")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--anzahl", type=int, default=30)
    ap.add_argument("--url", default="")
    args = ap.parse_args()

    neu: list[tuple[str, str]] = []
    db = SessionLocal()
    try:
        ohne_schueler = db.query(Student).count() == 0
        if pw := _zugang(db, "moderation", "admin", "Workshop", "Moderation"):
            neu.append(("moderation", pw))
        for i in range(1, args.anzahl + 1):
            name = f"ws{i:02d}"
            if pw := _zugang(db, name, "teacher", "Teilnehmer·in", f"{i:02d}"):
                neu.append((name, pw))
        db.commit()
    finally:
        db.close()

    if neu:
        with ZUGAENGE.open("a", encoding="utf-8") as f:
            f.writelines(f"{u}\t{p}\n" for u, p in neu)
    print(f"{len(neu)} neue Zugänge")

    zugaenge = dict(z.split("\t") for z in ZUGAENGE.read_text(encoding="utf-8").split("\n") if z)
    token = _login("moderation", zugaenge["moderation"]) if ohne_schueler or not MARKER.exists() else ""
    if ohne_schueler:
        print(_schueler_importieren(token), "Schülerinnen und Schüler importiert (erfunden)")
    if not MARKER.exists():
        for pfad, datei in BEISPIELE:
            try:
                _hochladen(token, pfad, DATA / datei)
                print("Beispiel geladen:", datei)
            except urllib.error.HTTPError as e:  # ein veraltetes Beispiel hält den Rest nicht auf
                print("Beispiel übersprungen:", datei, e.code, e.read()[:200].decode(errors="replace"))
        MARKER.touch()

    if args.url:
        import qrcode
        qr = qrcode.QRCode(border=1)
        qr.add_data(args.url)
        qr.print_ascii(invert=True)
        _verteilung(args.url, zugaenge)


def _verteilung(url: str, zugaenge: dict[str, str]) -> None:
    """Dateien zum Verteilen der Zugänge nach data/zugaenge/ (workshop.ps1 kopiert sie nach workshop/zugaenge/).
    Die Tunnel-Adresse ist bei jedem Start neu, deshalb wird alles jedes Mal neu geschrieben."""
    import base64
    import html
    import io

    import qrcode

    ziel = DATA / "zugaenge"
    ziel.mkdir(exist_ok=True)
    puffer = io.BytesIO()
    qrcode.make(url).save(puffer, format="PNG")
    (ziel / "workshop-qr.png").write_bytes(puffer.getvalue())
    qr_src = "data:image/png;base64," + base64.b64encode(puffer.getvalue()).decode()
    teilnehmende = [(u, p) for u, p in zugaenge.items() if u != "moderation"]

    (ziel / "zugaenge.txt").write_text(
        f"Adresse: {url}\n\n" + "".join(f"{u}\t{p}\n" for u, p in zugaenge.items()), encoding="utf-8")
    (ziel / "chat-nachricht.txt").write_text(
        "Willkommen! Wir spielen gleich live in TT.\n"
        f"1. Öffnet {url}/play\n"
        "2. Gebt den Code ein, den ich gleich zeige, und wählt Name und Avatar. Ein Konto braucht ihr dafür nicht.\n"
        "Zum Selberbauen bekommt ihr gleich per Privatnachricht einen eigenen Lehrkraft-Zugang.\n", encoding="utf-8")
    (ziel / "privat-nachrichten.txt").write_text("".join(
        f"[{u}] Dein Workshop-Zugang zum Selberbauen: {url} · unten links »Anmelden« · "
        f"Benutzer {u} · Passwort {p} · Die Übungsinstanz wird nach dem Workshop gelöscht.\n"
        for u, p in teilnehmende), encoding="utf-8")
    karten = "".join(
        f'<div class="karte"><img src="{qr_src}" alt=""><div><b>TT-Workshop</b><span>{html.escape(url)}</span>'
        f'<span>Benutzer <code>{u}</code></span><span>Passwort <code>{html.escape(p)}</code></span>'
        f'<small>Unten links »Anmelden«. Wird nach dem Workshop gelöscht.</small></div></div>'
        for u, p in teilnehmende)
    (ziel / "Zugangskarten.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>TT-Workshop: Zugangskarten</title><style>'
        'body{font:14px system-ui,sans-serif;margin:16px}.raster{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:10px}'
        '.karte{display:flex;gap:10px;align-items:center;border:1px dashed #888;border-radius:8px;padding:10px;break-inside:avoid}'
        '.karte img{width:96px;height:96px}.karte div{display:grid;gap:3px}.karte span{overflow-wrap:anywhere}'
        'code{font-size:15px;font-weight:700}small{color:#555}@media print{h1,p{display:none}}</style>'
        f'<h1>Zugangskarten</h1><p>Je Teilnehmer·in eine Karte. Drucken und schneiden oder einzeln per Privatnachricht schicken '
        f'(Text dafür in privat-nachrichten.txt).</p><div class="raster">{karten}</div>', encoding="utf-8")
    print(f"Verteilung: {len(teilnehmende)} Zugangskarten, Chat- und Privatnachrichten in data/zugaenge/")


if __name__ == "__main__":
    main()
