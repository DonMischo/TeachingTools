"""Kartentool: eigene Ebenen von Lehrkräften (GeoJSON, KML, KMZ, GPX).

Alles wird zu einem schlichten GeoJSON in WGS84: je Objekt ``id``, ``name``
und die ursprünglichen einfachen Eigenschaften (Texte/Zahlen), damit man das
Namensfeld später umstellen kann. Abgelegt wird es getrennt von den
Grunddaten unter data/karten/eigene/ — die Grundebenen bleiben unberührt.
"""
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET

MAX_BYTES = 5 * 1024 * 1024
MAX_OBJEKTE = 5000
MAX_EIGENSCHAFTEN = 20
NAMENSFELDER = ["name", "Name", "NAME", "titel", "Titel", "title", "Title", "bezeichnung", "Bezeichnung", "label", "Label"]


class UploadFehler(ValueError):
    """Meldung geht so an die Lehrkraft."""


# ── Einlesen ─────────────────────────────────────────────────────────

def _geojson(roh: bytes) -> list[dict]:
    try:
        daten = json.loads(roh.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise UploadFehler("Die Datei ist kein gültiges GeoJSON.") from e
    crs = (daten.get("crs") or {}).get("properties", {}).get("name", "") if isinstance(daten, dict) else ""
    if crs and not re.search(r"CRS84|4326", crs):
        raise UploadFehler(f"Koordinatensystem {crs} wird nicht unterstützt — bitte als WGS84 (Längen-/Breitengrade) speichern.")
    if not isinstance(daten, dict):
        raise UploadFehler("Die Datei ist kein gültiges GeoJSON.")
    if daten.get("type") == "FeatureCollection":
        return [f for f in daten.get("features", []) if isinstance(f, dict)]
    if daten.get("type") == "Feature":
        return [daten]
    if daten.get("type") in ("Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection"):
        return [{"type": "Feature", "geometry": daten, "properties": {}}]
    raise UploadFehler("Die Datei ist kein gültiges GeoJSON.")


def _xml(roh: bytes) -> ET.Element:
    kopf = roh[:4096].decode("utf-8", "ignore")
    if "<!DOCTYPE" in kopf or "<!ENTITY" in roh.decode("utf-8", "ignore"):
        raise UploadFehler("XML mit DOCTYPE/ENTITY wird aus Sicherheitsgründen nicht angenommen.")
    try:
        return ET.fromstring(roh)
    except ET.ParseError as e:
        raise UploadFehler("Die Datei ist kein gültiges XML.") from e


def _lokal(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _kinder(el: ET.Element, name: str):
    return [k for k in el.iter() if _lokal(k.tag) == name]


def _text(el: ET.Element, name: str) -> str:
    for k in el:
        if _lokal(k.tag) == name and k.text:
            return k.text.strip()
    return ""


def _kml_koordinaten(text: str) -> list[list[float]]:
    punkte = []
    for teil in text.split():
        werte = teil.split(",")
        if len(werte) >= 2:
            punkte.append([float(werte[0]), float(werte[1])])
    return punkte


def _kml_geometrie(el: ET.Element) -> dict | None:
    art = _lokal(el.tag)
    if art == "Point":
        p = _kml_koordinaten(_text(el, "coordinates"))
        return {"type": "Point", "coordinates": p[0]} if p else None
    if art == "LineString":
        p = _kml_koordinaten(_text(el, "coordinates"))
        return {"type": "LineString", "coordinates": p} if len(p) >= 2 else None
    if art == "Polygon":
        ringe = []
        for grenze in el:
            if _lokal(grenze.tag) in ("outerBoundaryIs", "innerBoundaryIs"):
                for ring in _kinder(grenze, "LinearRing"):
                    ringe.append(_kml_koordinaten(_text(ring, "coordinates")))
        return {"type": "Polygon", "coordinates": ringe} if ringe and len(ringe[0]) >= 4 else None
    if art == "MultiGeometry":
        teile = [g for k in el if (g := _kml_geometrie(k))]
        return {"type": "GeometryCollection", "geometries": teile} if teile else None
    return None


def _kml(roh: bytes) -> list[dict]:
    wurzel = _xml(roh)
    features = []
    for pm in _kinder(wurzel, "Placemark"):
        geometrie = next((g for k in pm if (g := _kml_geometrie(k))), None)
        if not geometrie:
            continue
        eigenschaften = {"name": _text(pm, "name")}
        if beschreibung := _text(pm, "description"):
            eigenschaften["beschreibung"] = re.sub(r"<[^>]+>", " ", beschreibung)[:500]
        for daten in _kinder(pm, "Data"):
            if (schluessel := daten.get("name")) and (wert := _text(daten, "value")):
                eigenschaften[schluessel] = wert
        for daten in _kinder(pm, "SimpleData"):
            if (schluessel := daten.get("name")) and daten.text:
                eigenschaften[schluessel] = daten.text.strip()
        features.append({"type": "Feature", "geometry": geometrie, "properties": eigenschaften})
    return features


def _kmz(roh: bytes) -> list[dict]:
    try:
        archiv = zipfile.ZipFile(io.BytesIO(roh))
    except zipfile.BadZipFile as e:
        raise UploadFehler("Die KMZ-Datei ist beschädigt.") from e
    kml = next((n for n in archiv.namelist() if n.lower().endswith(".kml")), None)
    if not kml:
        raise UploadFehler("In der KMZ-Datei steckt keine KML.")
    info = archiv.getinfo(kml)
    if info.file_size > MAX_BYTES * 4:
        raise UploadFehler("Die KML in der KMZ-Datei ist zu groß.")
    return _kml(archiv.read(kml))


def _gpx(roh: bytes) -> list[dict]:
    wurzel = _xml(roh)
    punkt = lambda el: [float(el.get("lon")), float(el.get("lat"))]  # noqa: E731
    features = []
    for wpt in _kinder(wurzel, "wpt"):
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": punkt(wpt)},
                         "properties": {"name": _text(wpt, "name"), "beschreibung": _text(wpt, "desc")}})
    for trk in _kinder(wurzel, "trk"):
        linien = [[punkt(p) for p in _kinder(seg, "trkpt")] for seg in _kinder(trk, "trkseg")]
        linien = [l for l in linien if len(l) >= 2]
        if linien:
            features.append({"type": "Feature", "geometry": {"type": "MultiLineString", "coordinates": linien},
                             "properties": {"name": _text(trk, "name")}})
    for rte in _kinder(wurzel, "rte"):
        linie = [punkt(p) for p in _kinder(rte, "rtept")]
        if len(linie) >= 2:
            features.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": linie},
                             "properties": {"name": _text(rte, "name")}})
    return features


# ── Prüfen und vereinheitlichen ──────────────────────────────────────

def _alle_koordinaten(g: dict):
    if g["type"] == "GeometryCollection":
        for teil in g["geometries"]:
            yield from _alle_koordinaten(teil)
        return
    stapel = [g["coordinates"]]
    while stapel:
        x = stapel.pop()
        if x and isinstance(x[0], (int, float)):
            yield x
        else:
            stapel.extend(x)


GEOMETRIE = {"Point": "punkt", "MultiPoint": "punkt", "LineString": "linie", "MultiLineString": "linie",
             "Polygon": "flaeche", "MultiPolygon": "flaeche"}


def _geometrie_art(g: dict) -> str:
    if g["type"] == "GeometryCollection":
        arten = {_geometrie_art(t) for t in g["geometries"]}
        return arten.pop() if len(arten) == 1 else "gemischt"
    return GEOMETRIE.get(g["type"], "gemischt")


def namensfeld_raten(features: list[dict]) -> str:
    felder = {k for f in features for k, v in f["properties"].items() if isinstance(v, str) and v.strip()}
    return next((n for n in NAMENSFELDER if n in felder), "")


def mit_namen(features: list[dict], namensfeld: str) -> list[dict]:
    """Setzt ``name`` aus dem gewählten Feld (sonst »Objekt n«)."""
    for i, f in enumerate(features, 1):
        wert = f["properties"].get("_orig", {}).get(namensfeld) if namensfeld else None
        f["properties"]["name"] = str(wert).strip() if wert not in (None, "") else f"Objekt {i}"
    return features


def lies_upload(dateiname: str, roh: bytes) -> tuple[list[dict], list[str], str]:
    """→ (Features mit id/name/_orig, mögliche Namensfelder, geratenes Namensfeld)."""
    if len(roh) > MAX_BYTES:
        raise UploadFehler("Die Datei ist größer als 5 MB.")
    endung = dateiname.lower().rsplit(".", 1)[-1]
    leser = {"geojson": _geojson, "json": _geojson, "kml": _kml, "kmz": _kmz, "gpx": _gpx}.get(endung)
    if not leser:
        raise UploadFehler("Erlaubt sind GeoJSON, KML, KMZ und GPX.")
    try:
        roh_features = leser(roh)
    except (TypeError, ValueError, KeyError) as e:
        if isinstance(e, UploadFehler):
            raise
        raise UploadFehler("Die Datei enthält ungültige Koordinaten.") from e
    roh_features = [f for f in roh_features if isinstance(f.get("geometry"), dict) and f["geometry"].get("type")]
    if not roh_features:
        raise UploadFehler("Die Datei enthält keine Punkte, Linien oder Flächen.")
    if len(roh_features) > MAX_OBJEKTE:
        raise UploadFehler(f"Höchstens {MAX_OBJEKTE} Objekte je Ebene (hier: {len(roh_features)}).")

    features = []
    for i, f in enumerate(roh_features, 1):
        g = f["geometry"]
        try:
            for lon, lat, *_ in _alle_koordinaten(g):
                if not (-180 <= float(lon) <= 180 and -90 <= float(lat) <= 90):
                    raise UploadFehler("Koordinaten liegen außerhalb von WGS84 — bitte als Längen-/Breitengrade speichern.")
        except (TypeError, ValueError, KeyError) as e:
            if isinstance(e, UploadFehler):
                raise
            raise UploadFehler("Die Datei enthält ungültige Koordinaten.") from e
        einfach = {str(k)[:60]: v for k, v in (f.get("properties") or {}).items()
                   if isinstance(v, (str, int, float)) and not isinstance(v, bool)}
        einfach = dict(list(einfach.items())[:MAX_EIGENSCHAFTEN])
        einfach = {k: (v[:300] if isinstance(v, str) else v) for k, v in einfach.items()}
        features.append({"type": "Feature", "geometry": g, "properties": {"id": f"o{i}", "_orig": einfach}})

    felder = sorted({k for f in features for k, v in f["properties"]["_orig"].items() if isinstance(v, str)})
    geraten = namensfeld_raten([{"properties": f["properties"]["_orig"]} for f in features])
    return features, felder, geraten


def geometrie_von(features: list[dict]) -> str:
    arten = {_geometrie_art(f["geometry"]) for f in features}
    return arten.pop() if len(arten) == 1 else "gemischt"
