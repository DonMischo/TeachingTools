"""Kartenquiz: Aufgaben aus einem Kartensatz bauen, für Spieler entschärfen, Antworten prüfen.

Reine Logik ohne Datenbank — das eigenständige Spiel (routers/karten.py), Caputh
und TaskCrawler nutzen dieselben Funktionen (wie timeline_engine.py).

Modi:
  benennen  Die Karte zeigt Nummern; zu jeder Nummer den Namen eintippen
            (oder aus der Wortbank wählen).
  finden    Ein Name ist gegeben; das Objekt auf der Karte anklicken.

Spieler sehen weder Namen noch echte ids: Die ids der Ebenen verraten die
Antwort (»saale-56«), deshalb bekommt jedes Objekt je Quiz ein Token.
"""
import hashlib
import hmac
import math
import random
import re
import unicodedata

MODI = ("benennen", "finden")

# Muss zu frontend/src/lib/karten/nummern.ts passen
_ROEMISCH = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
             (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]


def marke(schema: str, n: int) -> str:
    if schema == "zahl":
        return str(n)
    if schema in ("klein", "gross"):
        s, k = "", n
        while k > 0:
            s = chr(97 + (k - 1) % 26) + s
            k = (k - 1) // 26
        return s.upper() if schema == "gross" else s
    if schema == "roemisch":
        s, rest = "", n
        for wert, zeichen in _ROEMISCH:
            while rest >= wert:
                s, rest = s + zeichen, rest - wert
        return s
    return ""


def vergib_nummern(auswahl: dict, reihenfolge: list[str]) -> dict[str, dict[str, str]]:
    """Wie vergibNummern im Frontend: gleiches Schema zählt über Ebenen weiter."""
    zaehler: dict[str, int] = {}
    ergebnis: dict[str, dict[str, str]] = {}
    for ebene in reihenfolge:
        wahl = auswahl.get(ebene)
        if not wahl or not wahl.get("objekte"):
            continue
        schema = wahl.get("nummerierung", "keine")
        ergebnis[ebene] = {}
        for oid in wahl["objekte"]:
            if schema == "keine":
                ergebnis[ebene][oid] = ""
                continue
            zaehler[schema] = zaehler.get(schema, 0) + 1
            ergebnis[ebene][oid] = marke(schema, zaehler[schema])
    return ergebnis


# ── Ankerpunkt (wie ankerpunkt in nummern.ts) ────────────────────────

def _im_ring(p, ring) -> bool:
    x, y, drin = p[0], p[1], False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][:2]
        xj, yj = ring[j][:2]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            drin = not drin
        j = i
    return drin


def _flaeche(ring) -> float:
    a, j = 0.0, len(ring) - 1
    for i in range(len(ring)):
        a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
        j = i
    return abs(a / 2)


def _rand_abstand(p, poly) -> float:
    m = math.inf
    for ring in poly:
        for i in range(1, len(ring)):
            (ax, ay), (bx, by) = ring[i - 1][:2], ring[i][:2]
            dx, dy = bx - ax, by - ay
            ll = dx * dx + dy * dy
            t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / ll)) if ll else 0.0
            m = min(m, math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)))
    return m


def ankerpunkt(g: dict) -> list[float] | None:
    art = g.get("type")
    if art == "Point":
        return g["coordinates"][:2]
    if art in ("LineString", "MultiLineString"):
        punkte = g["coordinates"] if art == "LineString" else [p for teil in g["coordinates"] for p in teil]
        if not punkte:
            return None
        mx = sum(p[0] for p in punkte) / len(punkte)
        my = sum(p[1] for p in punkte) / len(punkte)
        return min(punkte, key=lambda p: math.hypot(p[0] - mx, p[1] - my))[:2]
    if art in ("Polygon", "MultiPolygon"):
        teile = [g["coordinates"]] if art == "Polygon" else g["coordinates"]
        poly = max(teile, key=lambda t: _flaeche(t[0]))
        xs, ys = [p[0] for p in poly[0]], [p[1] for p in poly[0]]
        bester, abstand, n = poly[0][0][:2], -1.0, 24
        for i in range(n + 1):
            for j in range(n + 1):
                p = [min(xs) + (max(xs) - min(xs)) * i / n, min(ys) + (max(ys) - min(ys)) * j / n]
                if _im_ring(p, poly[0]) and not any(_im_ring(p, loch) for loch in poly[1:]):
                    d = _rand_abstand(p, poly)
                    if d > abstand:
                        bester, abstand = p, d
        return bester
    if art == "MultiPoint" and g["coordinates"]:
        return g["coordinates"][0][:2]
    return None


# ── Aufgaben ─────────────────────────────────────────────────────────

def aufgaben_aus_satz(inhalt: dict, reihenfolge: list[str], features_von, ebenen_namen: dict[str, str]) -> list[dict]:
    """Jedes ausgewählte Objekt eines Kartensatzes wird eine Aufgabe.

    ``features_von(ebene)`` liefert die Features der Ebene (dict id → Feature).
    """
    nummern = vergib_nummern(inhalt.get("auswahl", {}), reihenfolge)
    aufgaben = []
    for ebene in reihenfolge:
        if ebene not in nummern:
            continue
        features = features_von(ebene)
        for oid, m in nummern[ebene].items():
            f = features.get(oid)
            if not f:
                continue
            p = f["properties"]
            aufgaben.append({
                "nr": len(aufgaben) + 1, "ebene": ebene, "id": oid, "marke": m,
                "name": p.get("name", ""), "alternativen": [a for a in [p.get("name2")] if a],
                "kategorie": ebenen_namen.get(ebene, ebene), "anker": ankerpunkt(f["geometry"]),
            })
    return aufgaben


def token(geheim: str, ebene: str, oid: str) -> str:
    """Undurchsichtige id je Quiz — verrät nichts über den Namen."""
    return hmac.new(geheim.encode(), f"{ebene}:{oid}".encode(), hashlib.sha256).hexdigest()[:12]


def fuer_spieler(aufgaben: list[dict], modus: str, geheim: str, wortbank: bool = False, mischen: int | None = None) -> dict:
    """Was der Spieler sieht: benennen → Marken und Ankerpunkte, finden → Namen und Ebenen."""
    if modus == "benennen":
        sichtbar = [{"nr": a["nr"], "marke": a["marke"] or str(a["nr"]), "kategorie": a["kategorie"],
                     "ebene": a["ebene"], "anker": a["anker"]} for a in aufgaben]
    else:
        sichtbar = [{"nr": a["nr"], "name": a["name"], "kategorie": a["kategorie"], "ebene": a["ebene"]} for a in aufgaben]
        if mischen is not None:
            random.Random(mischen).shuffle(sichtbar)
    ergebnis = {"modus": modus, "aufgaben": sichtbar,
                "auswahl": _tokens_je_ebene(aufgaben, geheim)}
    if wortbank and modus == "benennen":
        namen = sorted({a["name"] for a in aufgaben}, key=lambda n: n.casefold())
        ergebnis["wortbank"] = namen
    return ergebnis


def _tokens_je_ebene(aufgaben: list[dict], geheim: str) -> dict[str, list[str]]:
    je: dict[str, list[str]] = {}
    for a in aufgaben:
        je.setdefault(a["ebene"], []).append(token(geheim, a["ebene"], a["id"]))
    return je


# Eigenschaften, die auf der Spielerkarte bleiben dürfen (Darstellung), alles andere fällt weg
ERLAUBTE_EIGENSCHAFTEN = {"klasse", "rang", "hoehe", "ew", "art", "farbe", "dichte", "leistung"}


def entschaerfe_ebene(sammlung: dict, ebene: str, geheim: str) -> dict:
    """GeoJSON ohne Namen, mit Token statt id."""
    features = []
    for f in sammlung["features"]:
        p = f["properties"]
        neu = {k: v for k, v in p.items() if k in ERLAUBTE_EIGENSCHAFTEN}
        neu["id"] = token(geheim, ebene, p["id"])
        features.append({"type": "Feature", "geometry": f["geometry"], "properties": neu})
    return {"type": "FeatureCollection", "features": features}


# ── Antworten prüfen ─────────────────────────────────────────────────

_ARTIKEL = re.compile(r"^(der|die|das|den|dem|des|the|le|la|les|el)\s+")


def normalisiere(s: str) -> str:
    s = s.casefold().strip()
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    s = _ARTIKEL.sub("", s)
    return re.sub(r"[^a-z0-9]+", "", s)


def _abstand(a: str, b: str) -> int:
    """Editierabstand mit Vertauschung benachbarter Buchstaben (»Wlad« → »Wald« = 1 Fehler)."""
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        d[i][0] = i
    for j in range(len(b) + 1):
        d[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] != b[j - 1]))
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[-1][-1]


def name_passt(eingabe: str, aufgabe: dict) -> bool:
    """Groß/klein, Artikel, Umlaute egal; ab 6 Buchstaben ein Tippfehler erlaubt."""
    e = normalisiere(eingabe)
    if not e:
        return False
    for richtig in [aufgabe["name"], *aufgabe.get("alternativen", [])]:
        r = normalisiere(richtig)
        if e == r or (len(r) >= 6 and _abstand(e, r) <= 1):
            return True
    return False


def pruefe(aufgabe: dict, modus: str, antwort, geheim: str) -> bool:
    if modus == "benennen":
        return isinstance(antwort, str) and name_passt(antwort, aufgabe)
    return isinstance(antwort, str) and hmac.compare_digest(antwort, token(geheim, aufgabe["ebene"], aufgabe["id"]))
