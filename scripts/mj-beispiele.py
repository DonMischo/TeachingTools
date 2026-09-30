"""
Überträgt Beispiele aus MarkovJunior (Maxim Gumin, MIT-Lizenz,
https://github.com/mxgmn/MarkovJunior) in das Textformat der Regelmaschine
des Regel-Labors und schreibt frontend/src/lib/regeln/mj-beispiele.ts.

Übernommen wird nur, was die Maschine wirklich kann: 2D, Knoten sequence /
markov / one / all / prl / path / convolution (Moore), Symmetrie (), (x)
oder voll, nur Großbuchstaben. Alles mit wfc, convchain, map, field,
observe, search, union, Dateiregeln oder Unterknoten, die sich nicht flach
als Blockfolge schreiben lassen, wird übersprungen (Grund steht im Bericht).

Aufruf (lädt die XML-Dateien selbst):
    python scripts/mj-beispiele.py
Danach prüft frontend/src/tests/regeln.mj.test.ts jedes Beispiel; wer dort
nicht in vertretbarer Zeit fertig wird, kommt in AUSSCHLUSS.
"""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROH = "https://raw.githubusercontent.com/mxgmn/MarkovJunior/main/"
ZIEL = Path(__file__).resolve().parent.parent / "frontend" / "src" / "lib" / "regeln" / "mj-beispiele.ts"
MAX_GROESSE = 79          # größere Felder werden verkleinert (Rechenzeit im Browser)
# Nach der Prüfung (regeln.mj.test.ts) ausgeschlossen: zu langsam oder ohne sichtbares Ergebnis
AUSSCHLUSS = {"Digger", "GrowthCompetition", "GrowthContraction", "River"}


class Nein(Exception):
    """Dieses Modell lässt sich nicht übertragen."""


def laden(pfad: str) -> str:
    return urllib.request.urlopen(ROH + pfad, timeout=30).read().decode("utf-8-sig")


def muster(t: str) -> str:
    if " " in t:
        raise Nein("3D-Muster")
    if re.search(r"[^A-Z*/]", t):
        raise Nein(f"Zeichen außerhalb A-Z: {t}")
    return t


def symmetrie(knoten, erbt: str) -> str:
    s = knoten.get("symmetry")
    if s is None:
        return erbt
    if s == "()":
        return "fest"
    if s == "(x)":
        return "spiegel"
    if s in ("(xy)", ""):
        return "alle"
    raise Nein(f"Symmetrie {s}")


def regeln_von(knoten) -> list[str]:
    if knoten.get("file") or knoten.find("rule[@file]") is not None:
        raise Nein("Regel aus Datei")
    for verboten in ("field", "observe", "union"):
        if knoten.find(verboten) is not None:
            raise Nein(verboten)
    if knoten.get("search") or knoten.get("temperature"):
        raise Nein("search/temperature")
    rs = []
    if knoten.get("in") is not None:
        rs.append(f"{muster(knoten.get('in'))}={muster(knoten.get('out'))}")
    for r in knoten.findall("rule"):
        if r.get("p"):
            raise Nein("Regel mit eigener Wahrscheinlichkeit")
        rs.append(f"{muster(r.get('in'))}={muster(r.get('out'))}")
    if not rs:
        raise Nein("Knoten ohne Regel")
    for r in rs:
        a, e = r.split("=")
        if [len(z) for z in a.split("/")] != [len(z) for z in e.split("/")]:
            raise Nein("Muster ungleich groß")
    return rs


def kopf(art: str, knoten, sym: str) -> str:
    teile = [art]
    if knoten.get("steps"):
        teile.append(f"x{knoten.get('steps')}")
    if art == "alle" and knoten.get("p"):
        teile.append(f"p{round(float(knoten.get('p')) * 100)}")
    if sym != "alle":
        teile.append(sym)
    return " ".join(teile)


def blatt(knoten, sym: str) -> str:
    tag = knoten.tag
    sym = symmetrie(knoten, sym)
    if tag == "one":
        return f"{kopf('eins', knoten, sym)}: {', '.join(regeln_von(knoten))}"
    if tag in ("all", "prl"):
        return f"{kopf('alle', knoten, sym)}: {', '.join(regeln_von(knoten))}"
    if tag == "path":
        if knoten.get("longest") or knoten.get("edges") or knoten.get("vertices"):
            raise Nein("path mit Zusatzoptionen")
        von, nach, auf, farbe = (knoten.get(k) for k in ("from", "to", "on", "color"))
        for t in (von, nach, auf, farbe):
            muster(t)
        return f"pfad: {von} → {nach} über {auf} = {farbe}"
    if tag == "convolution":
        if knoten.get("neighborhood") != "Moore":
            raise Nein("convolution nicht Moore")
        teile = []
        for r in knoten.findall("rule"):
            if r.get("p"):
                raise Nein("convolution mit p")
            summe = r.get("sum")
            werte = r.get("values")
            if not summe or not werte:
                raise Nein("convolution ohne sum/values")
            m = re.fullmatch(r"(\d)(?:\.\.(\d))?", summe)
            if not m:
                raise Nein(f"sum {summe}")
            teile.append(f"{muster(r.get('in'))}={muster(r.get('out'))} bei {m.group(1)}{'-' + m.group(2) if m.group(2) else ''} {muster(werte)}")
        k = "nachbarn" + (f" x{knoten.get('steps')}" if knoten.get("steps") else "")
        return f"{k}: {', '.join(teile)}"
    raise Nein(f"Knoten {tag}")


def markov_block(knoten, sym: str) -> str:
    """markov aus lauter one-Knoten → ein markov-Block mit Ranggruppen."""
    sym = symmetrie(knoten, sym)
    gruppen = []
    for kind in knoten:
        if kind.tag != "one" or kind.get("steps") or symmetrie(kind, sym) != sym:
            raise Nein("markov mit anderen Unterknoten")
        gruppen.append(" | ".join(regeln_von(kind)))
    zusatz = f" {sym}" if sym != "alle" else ""
    return f"markov{zusatz}: {', '.join(gruppen)}"


def programm(wurzel) -> list[str]:
    sym = symmetrie(wurzel, "alle")
    if wurzel.tag == "sequence":
        zeilen = []
        for kind in wurzel:
            if kind.tag == "markov":
                zeilen.append(markov_block(kind, sym))
            elif kind.tag == "sequence":
                raise Nein("verschachtelte sequence")
            else:
                zeilen.append(blatt(kind, sym))
        return zeilen
    if wurzel.tag == "markov":
        return [markov_block(wurzel, "alle")]
    return [blatt(wurzel, "alle")]


def main():
    modelle = ET.fromstring(laden("models.xml"))
    gesehen, beispiele, bericht = set(), [], []
    for m in modelle.iter("model"):
        name = m.get("name")
        if m.get("d", "2") != "2" or name in gesehen or name in AUSSCHLUSS:
            continue
        gesehen.add(name)
        try:
            xml = laden(f"models/{name}.xml")
            if re.search(r"<(wfc|convchain|map|tile|field|observe|union)\b", xml):
                raise Nein("wfc/convchain/map/field/observe/union")
            wurzel = ET.fromstring(xml)
            werte = wurzel.get("values", "")
            if not werte or re.search(r"[^A-Z]", werte):
                raise Nein("Werte mit Kleinbuchstaben")
            zeilen = programm(wurzel)
            groesse = int(m.get("size") or m.get("length") or 0)
            if not groesse:
                raise Nein("keine Größe")
            schritte = int(m.get("steps")) if m.get("steps") else None
            if groesse > MAX_GROESSE and schritte:
                # kleineres Feld → entsprechend weniger Schritte, sonst ist am Ende alles voll
                schritte = max(1, round(schritte * (MAX_GROESSE / groesse) ** 2))
            groesse = min(groesse, MAX_GROESSE)
            if schritte:
                zeilen.insert(0, f"grenze {schritte}")
            start = {"b": groesse, "h": groesse, "grund": werte[0]}
            if wurzel.get("origin") == "True":
                start["mitte"] = werte[1]
            beispiele.append({"id": name, "programm": "\n".join(zeilen), "start": start})
        except Nein as e:
            bericht.append(f"– {name}: {e}")
        except Exception as e:  # kaputtes XML o. Ä.
            bericht.append(f"– {name}: {type(e).__name__} {e}")
    ts = [
        "/**",
        " * Beispiele aus MarkovJunior von Maxim Gumin (MIT-Lizenz),",
        " * https://github.com/mxgmn/MarkovJunior — automatisch übertragen von",
        " * scripts/mj-beispiele.py. Nicht von Hand ändern, sondern das Skript neu laufen lassen.",
        " */",
        'import type { Start } from "./maschine";',
        "",
        "export interface MjBeispiel { id: string; programm: string; start: Start }",
        "",
        "export const MJ_QUELLE = \"https://github.com/mxgmn/MarkovJunior\";",
        "",
        "export const MJ_BEISPIELE: MjBeispiel[] = " + json.dumps(beispiele, ensure_ascii=False, indent=2) + ";",
        "",
    ]
    ZIEL.write_text("\n".join(ts), encoding="utf-8")
    print(f"{len(beispiele)} übertragen, {len(bericht)} übersprungen:")
    print("\n".join(bericht))


if __name__ == "__main__":
    sys.exit(main())
