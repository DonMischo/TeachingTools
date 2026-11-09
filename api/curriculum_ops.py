"""Änderungen am Curriculum-Dokument (Werkzeug »curriculum«).

Ein Plan ist ein einziges JSON-Dokument im Format ``tt-curriculum/1``
(Lehrplan-Karten alt/neu, Abgleich alt↔neu, schulinternes Curriculum je Klasse;
Aufbau in data/curriculum/SCHEMA.md). Mehrere Lehrkräfte bearbeiten es
gleichzeitig, deshalb schicken die Seiten keine ganzen Dokumente, sondern
kleine Operationen, die der Server nacheinander auf den aktuellen Stand legt.
Wer zuletzt schreibt, gewinnt — aber nur für das eine Thema bzw. die eine Karte.
"""
from copy import deepcopy

FORMAT = "tt-curriculum/1"
NIVEAUS = ["G", "R", "H", "LB", "GE"]
TEILE = ("lehrplaene", "abgleich", "curriculum")


class OpFehler(ValueError):
    pass


def leer(fach: str = "Mathematik") -> dict:
    return {
        "format": FORMAT,
        "fach": fach,
        "niveaus": list(NIVEAUS),
        "bloecke": ["5/6", "7/8", "9/10"],
        "lehrplaene": [],
        "abgleich": [],
        "curriculum": {"stand": "", "klassen": []},
    }


def _hat_id(obj, was: str) -> str:
    if not isinstance(obj, dict) or not isinstance(obj.get("id"), str) or not obj["id"]:
        raise OpFehler(f"{was} braucht eine id")
    return obj["id"]


def _klasse(doc: dict, nr: int, anlegen: bool = True) -> dict:
    klassen = doc["curriculum"]["klassen"]
    for k in klassen:
        if k["klasse"] == nr:
            return k
    if not anlegen:
        raise OpFehler(f"Klasse {nr} gibt es nicht")
    k = {"klasse": nr, "wochen_verfuegbar": 36, "themen": []}
    klassen.append(k)
    klassen.sort(key=lambda x: x["klasse"])
    return k


def _lehrplan(doc: dict, lid: str) -> dict:
    for lp in doc["lehrplaene"]:
        if lp["id"] == lid:
            return lp
    raise OpFehler(f"Lehrplan {lid} gibt es nicht")


def _ersetzen(liste: list, obj: dict) -> None:
    for i, x in enumerate(liste):
        if x.get("id") == obj["id"]:
            liste[i] = obj
            return
    liste.append(obj)


def _paar_ids(abgleich: list) -> list:
    """Paare aus KI-Antworten haben oft keine id — fortlaufend vergeben."""
    belegt = {p.get("id") for p in abgleich}
    n = 1
    for p in abgleich:
        if not p.get("id"):
            while f"p{n}" in belegt:
                n += 1
            p["id"] = f"p{n}"
            belegt.add(p["id"])
    return abgleich


def pruefen(doc: dict) -> dict:
    """Grobe Formprüfung einer hochgeladenen Vorlage (auch Teil-Vorlagen)."""
    if not isinstance(doc, dict):
        raise OpFehler("Vorlage muss ein JSON-Objekt sein")
    if doc.get("format") not in (None, FORMAT):
        raise OpFehler(f"Unbekanntes Format {doc.get('format')!r}, erwartet {FORMAT}")
    for lp in doc.get("lehrplaene", []):
        _hat_id(lp, "Lehrplan")
        if lp.get("rolle") not in ("alt", "neu"):
            raise OpFehler(f"Lehrplan {lp['id']}: rolle muss alt oder neu sein")
        for k in lp.get("karten", []):
            _hat_id(k, "Karte")
    if not isinstance(doc.get("abgleich", []), list):
        raise OpFehler("abgleich muss eine Liste sein")
    cur = doc.get("curriculum")
    if cur is not None:
        for k in cur.get("klassen", []):
            if not isinstance(k.get("klasse"), int):
                raise OpFehler("Jede Klasse braucht eine Klassenstufe (Zahl)")
            for t in k.get("themen", []):
                _hat_id(t, "Thema")
    return doc


def _importieren(doc: dict, daten: dict) -> None:
    """Hochgeladene Teile ersetzen: Lehrpläne einzeln nach id, Abgleich und
    Curriculum jeweils ganz. Was die Datei nicht enthält, bleibt."""
    pruefen(daten)
    for lp in daten.get("lehrplaene", []):
        lp.setdefault("karten", [])
        _ersetzen(doc["lehrplaene"], lp)
    if "abgleich" in daten:
        doc["abgleich"] = _paar_ids(daten["abgleich"])
    if "curriculum" in daten:
        cur = daten["curriculum"]
        cur.setdefault("klassen", [])
        doc["curriculum"] = cur
    for feld in ("fach", "niveaus", "bloecke"):
        if feld in daten:
            doc[feld] = daten[feld]


def anwenden(doc: dict, op: dict) -> dict:
    """Eine Operation auf eine Kopie von ``doc`` legen und die Kopie zurückgeben."""
    doc = deepcopy(doc)
    art = op.get("op")

    if art == "thema":
        # Anlegen, Ändern und Verschieben (in eine andere Klasse / an eine Stelle).
        thema = op.get("thema")
        tid = _hat_id(thema, "Thema")
        ziel = _klasse(doc, int(op["klasse"]))
        alt_pos = None
        for k in doc["curriculum"]["klassen"]:
            for i, t in enumerate(k["themen"]):
                if t["id"] == tid:
                    if k is ziel:
                        alt_pos = i
                    del k["themen"][i]
                    break
        pos = op.get("pos", alt_pos if alt_pos is not None else len(ziel["themen"]))
        ziel["themen"].insert(max(0, min(int(pos), len(ziel["themen"]))), thema)

    elif art == "thema_loeschen":
        for k in doc["curriculum"]["klassen"]:
            k["themen"] = [t for t in k["themen"] if t["id"] != op.get("id")]

    elif art == "klasse":
        k = _klasse(doc, int(op["klasse"]))
        if "wochen_verfuegbar" in op:
            k["wochen_verfuegbar"] = op["wochen_verfuegbar"]

    elif art == "karte":
        karte = op.get("karte")
        _hat_id(karte, "Karte")
        _ersetzen(_lehrplan(doc, op.get("lehrplan"))["karten"], karte)

    elif art == "karte_loeschen":
        lp = _lehrplan(doc, op.get("lehrplan"))
        lp["karten"] = [k for k in lp["karten"] if k["id"] != op.get("id")]

    elif art == "paar":
        paar = op.get("paar")
        if isinstance(paar, dict) and not paar.get("id"):
            _paar_ids(doc["abgleich"] + [paar])
        _hat_id(paar, "Paar")
        _ersetzen(doc["abgleich"], paar)

    elif art == "paar_loeschen":
        doc["abgleich"] = [p for p in doc["abgleich"] if p.get("id") != op.get("id")]

    elif art == "sammlung":
        # Fragmente-Sammlung, aus der »+ Material« Karten und Clippings anbietet (None = alle)
        sid = op.get("id")
        if sid is not None and (isinstance(sid, bool) or not isinstance(sid, int)):
            raise OpFehler("Sammlung braucht eine Zahl oder null")
        doc["sammlung"] = sid

    elif art == "import":
        _importieren(doc, op.get("daten"))

    else:
        raise OpFehler(f"Unbekannte Operation {art!r}")
    return doc
