"""Workshop-Instanz befüllen: Moderations-Admin, Teilnehmer-Zugänge, Beispielinhalte
und die erfundene Schülerliste data/workshop/schueler.csv (5a–10c).

Nur für die Übungsinstanz aus workshop.ps1 gedacht (eigene Datenbank, erfundene
Daten), nie für eine Schulinstanz. Läuft im API-Container:

    python -m api.workshop_seed [--anzahl 30] [--url https://….trycloudflare.com]

Mehrfach aufrufbar: vorhandene Zugänge bleiben, Beispiele werden nur einmal
hochgeladen. Die Zugangsliste landet in data/zugaenge.txt (bei der
Workshop-Instanz also in .workshop/data/, nicht im Repo).
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
    print(f"{len(neu)} neue Zugänge, Liste: .workshop/data/zugaenge.txt")

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
        qrcode.make(args.url).save(DATA / "workshop-qr.png")


if __name__ == "__main__":
    main()
