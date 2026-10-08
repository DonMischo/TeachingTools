"""Equal-Earth-Projektion für das Kartentool (Šavrič, Patterson, Jenny 2018).

MapLibre kann nur Web-Mercator. Damit die Karte trotzdem in Equal Earth
erscheint, werden die Koordinaten umgerechnet und als »Schein-Länge/Breite«
ausgeliefert: x → Länge linear, y → Breite so, dass Mercator sie wieder
linear abbildet. MapLibre zeichnet dann genau das Equal-Earth-Bild.

Dieselbe Rechnung steht in frontend/src/lib/karten/projektion.ts und
frontend/scripts/karten-daten/projektion.mjs (Rasterkacheln).
"""
import math

A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2
XMAX = math.pi / (M * A1)  # x am Äquator bei ±180°

PROJEKTIONEN = ("equalearth", "mercator", "globus")


def vor(lon: float, lat: float) -> tuple[float, float]:
    """Echte Länge/Breite → Schein-Länge/Breite für MapLibre."""
    lam, phi = math.radians(lon), math.radians(max(-90.0, min(90.0, lat)))
    t = math.asin(M * math.sin(phi))
    t2 = t * t
    t6 = t2 * t2 * t2
    x = lam * math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
    y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return x / XMAX * 180, math.degrees(math.atan(math.sinh(y * math.pi / XMAX)))


def _runde(p):
    return [round(p[0], 5), round(p[1], 5)]


def _koordinaten(c):
    if c and isinstance(c[0], (int, float)):
        return _runde(vor(c[0], c[1]))
    return [_koordinaten(x) for x in c]


def transformiere(sammlung: dict) -> dict:
    """FeatureCollection in Equal Earth (Schein-Koordinaten); Eigenschaften bleiben."""
    features = []
    for f in sammlung["features"]:
        g = f.get("geometry")
        if g and "coordinates" in g:
            g = {**g, "coordinates": _koordinaten(g["coordinates"])}
        features.append({**f, "geometry": g})
    return {**sammlung, "features": features}
