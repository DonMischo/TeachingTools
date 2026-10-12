"""Kartennetze für das Kartentool: Equal Earth (Šavrič, Patterson, Jenny 2018),
Robinson und Winkel-Tripel (über PROJ/pyproj).

MapLibre kann nur Web-Mercator (und den Globus). Damit die Karte trotzdem in
einem anderen Netz erscheint, werden die Koordinaten umgerechnet und als
»Schein-Länge/Breite« ausgeliefert: x → Länge linear, y → Breite so, dass
Mercator sie wieder linear abbildet. MapLibre zeichnet dann genau das Bild des
Netzes. Mercator und Globus bleiben in echten Koordinaten.

Dieselbe Rechnung steht in frontend/src/lib/karten/projektion.ts (die Datei
lädt auch frontend/scripts/fetch-karten.mjs für die Rasterkacheln).
"""
import math

from pyproj import Proj

A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2
XMAX = math.pi / (M * A1)  # x am Äquator bei ±180°

# »kinder« (Kinderatlas) rechnet der Browser als Robinson und fragt die Ebenen so an
PROJEKTIONEN = ("equalearth", "mercator", "globus", "robinson", "winkeltripel", "kinder")
# Netze mit Schein-Koordinaten (alles andere zeichnet MapLibre selbst)
SCHEIN = ("equalearth", "robinson", "winkeltripel")

# Winkel-Tripel mit Winkels eigenem Standardparallel arccos(2/π) — PROJ nimmt sonst 0°
_PROJ = {
    "robinson": Proj("+proj=robin +R=1"),
    "winkeltripel": Proj(f"+proj=wintri +lat_1={math.degrees(math.acos(2 / math.pi))} +R=1"),
}
_XMAX = {n: p(180, 0)[0] for n, p in _PROJ.items()}


def _schein(x: float, y: float, xmax: float) -> tuple[float, float]:
    return x / xmax * 180, math.degrees(math.atan(math.sinh(y * math.pi / xmax)))


def vor(lon: float, lat: float, projektion: str = "equalearth") -> tuple[float, float]:
    """Echte Länge/Breite → Schein-Länge/Breite für MapLibre."""
    lat = max(-90.0, min(90.0, lat))
    if projektion in _PROJ:
        x, y = _PROJ[projektion](lon, lat)
        return _schein(x, y, _XMAX[projektion])
    lam, phi = math.radians(lon), math.radians(lat)
    t = math.asin(M * math.sin(phi))
    t2 = t * t
    t6 = t2 * t2 * t2
    x = lam * math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
    y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return _schein(x, y, XMAX)


def _runde(p):
    return [round(p[0], 5), round(p[1], 5)]


def _punkte(c, ablage: list):
    """Alle Koordinatenpaare einer Geometrie der Reihe nach einsammeln."""
    if c and isinstance(c[0], (int, float)):
        ablage.append(c)
    else:
        for x in c:
            _punkte(x, ablage)


def _ersetze(c, neu):
    if c and isinstance(c[0], (int, float)):
        return next(neu)
    return [_ersetze(x, neu) for x in c]


def transformiere(sammlung: dict, projektion: str = "equalearth") -> dict:
    """FeatureCollection in Schein-Koordinaten des Netzes; Eigenschaften bleiben."""
    alle: list = []
    for f in sammlung["features"]:
        g = f.get("geometry")
        if g and "coordinates" in g:
            _punkte(g["coordinates"], alle)
    if projektion in _PROJ:
        # PROJ rechnet ganze Listen auf einmal — Punkt für Punkt wäre es zehnmal langsamer
        xs, ys = _PROJ[projektion]([p[0] for p in alle], [max(-90.0, min(90.0, p[1])) for p in alle])
        neu = iter([_runde(_schein(x, y, _XMAX[projektion])) for x, y in zip(xs, ys)])
    else:
        neu = iter([_runde(vor(p[0], p[1])) for p in alle])
    features = []
    for f in sammlung["features"]:
        g = f.get("geometry")
        if g and "coordinates" in g:
            g = {**g, "coordinates": _ersetze(g["coordinates"], neu)}
        features.append({**f, "geometry": g})
    return {**sammlung, "features": features}
