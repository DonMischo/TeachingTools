"""Curriculinator: Curriculum als DOCX, PDF oder SVG (Endfassung).

Aufbau wie die schulinternen Curricula: je Klasse eine Tabelle, Zeilen sind
die Unterrichtseinheiten (mit Wochen), Spalten die Niveaus G | R | H | LB | GE.
In einer Zelle steht unser Inhalt und darunter der Wortlaut der zugeordneten
Karten des neuen Lehrplans — nur der neue Text, nichts Durchgestrichenes.

Das DOCX wird direkt als WordprocessingML geschrieben (pandoc kann keine
Zellfarben), das PDF ist dieses DOCX durch LibreOffice. Das SVG zeichnet eine
Klasse; Zeilenumbrüche werden über eine mittlere Zeichenbreite geschätzt.
"""
import io
import tempfile
import textwrap
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from .doc_convert import convert_to_pdf

NIVEAUS = ["G", "R", "H", "LB", "GE"]
NIVEAU_NAME = {"G": "Gymnasialniveau", "R": "Realschulniveau", "H": "Hauptschulniveau",
               "LB": "Förderschwp. LB", "GE": "Förderschwp. GE"}
# wie NIVEAU_FARBE im Editor (frontend/src/components/curriculum/Editor.tsx)
NIVEAU_FARBE = {"G": "9B1C1C", "R": "2563EB", "H": "16A34A", "LB": "D97706", "GE": "7C3AED"}

FORMATE = {
    "docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"),
    "pdf": ("application/pdf", ".pdf"),
    "svg": ("image/svg+xml", ".svg"),
}


# ── Inhalt ───────────────────────────────────────────────────────────────────

def niveau_gilt(n: str, klasse: int) -> bool:
    return not (n == "H" and klasse > 9)


def karte_text(k: dict, n: str) -> str | None:
    """Wie karteText im Frontend: H übernimmt R, LB/GE nehmen H bzw. R."""
    t = k.get("niveaus", {})
    if t.get(n):
        return t[n]
    if n == "H":
        return t.get("R")
    if n in ("LB", "GE"):
        return t.get("H") or t.get("R")
    return None


def _wochen(w) -> str:
    if w is None:
        return "? Wochen"
    s = f"{w:g}".replace(".", ",")
    return f"{s} Woche" if w == 1 else f"{s} Wochen"


def klassen(doc: dict, nur: int | None = None) -> list[dict]:
    """Je Klasse: Kopfangaben und Zeilen mit den Zellen (Listen von Absätzen)."""
    karten = {k["id"]: k for lp in doc.get("lehrplaene", []) for k in lp.get("karten", [])}
    inkraft = {}
    for lp in doc.get("lehrplaene", []):
        if lp.get("rolle") == "neu":
            for kl, jahr in (lp.get("inkraft") or {}).items():
                inkraft.setdefault(int(kl), set()).add(jahr)
    out = []
    for kl in doc.get("curriculum", {}).get("klassen", []):
        nr = kl["klasse"]
        if nur is not None and nr != nur:
            continue
        zeilen = []
        for t in kl.get("themen", []):
            zellen = {}
            for n in NIVEAUS:
                if not niveau_gilt(n, nr):
                    zellen[n] = [("—", False)]
                    continue
                eigen = [(z.strip(), False) for z in (t.get("inhalte", {}).get(n) or "").split("\n") if z.strip()]
                lp = [(f"• {txt}", True) for kid in (t.get("zuordnung") or {}).get(n, [])
                      if kid in karten and (txt := karte_text(karten[kid], n))]
                zellen[n] = eigen + lp
            zeilen.append({"titel": t.get("titel") or "(ohne Titel)", "wochen": _wochen(t.get("wochen")),
                           "notiz": t.get("notiz") or "", "zellen": zellen})
        summe = sum(t.get("wochen") or 0 for t in kl.get("themen", []))
        kopf = f"verplant {_wochen(summe).replace(' Wochen', '').replace(' Woche', '')} von {kl.get('wochen_verfuegbar', 36)} Wochen"
        if nr in inkraft:
            kopf = f"neuer Lehrplan ab {' / '.join(sorted(inkraft[nr]))} · {kopf}"
        out.append({"klasse": nr, "kopf": kopf, "zeilen": zeilen})
    return out


def _untertitel(doc: dict, stand_name: str) -> str:
    neu = [lp.get("titel") or lp["id"] for lp in doc.get("lehrplaene", []) if lp.get("rolle") == "neu"]
    teile = [stand_name]
    if neu:
        teile.append("nach " + " · ".join(neu))
    return " — ".join(teile)


# ── DOCX ─────────────────────────────────────────────────────────────────────

SEITE_B, SEITE_H, RAND = 16838, 11906, 720          # A4 quer, 1,27 cm Rand (Twips)
NUTZ = SEITE_B - 2 * RAND
SP_EINHEIT = 2400
SP_NIVEAU = (NUTZ - SP_EINHEIT) // len(NIVEAUS)


def _lauf(text: str, fett=False, farbe: str | None = None, groesse: int | None = None) -> str:
    rpr = ("<w:b/>" if fett else "") + (f'<w:color w:val="{farbe}"/>' if farbe else "") + \
          (f'<w:sz w:val="{groesse}"/><w:szCs w:val="{groesse}"/>' if groesse else "")
    return f'<w:r>{f"<w:rPr>{rpr}</w:rPr>" if rpr else ""}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def _absatz(laeufe: str, nach=40, umbruch=False) -> str:
    pb = '<w:pageBreakBefore/>' if umbruch else ""
    return f'<w:p><w:pPr>{pb}<w:spacing w:before="0" w:after="{nach}"/></w:pPr>{laeufe}</w:p>'


def _zelle(breite: int, inhalt: str, fuellung: str | None = None) -> str:
    shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{fuellung}"/>' if fuellung else ""
    return (f'<w:tc><w:tcPr><w:tcW w:w="{breite}" w:type="dxa"/>{shd}</w:tcPr>'
            f'{inhalt or _absatz("")}</w:tc>')


def _tabelle(k: dict) -> str:
    rand = "".join(f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
                   for s in ("top", "left", "bottom", "right", "insideH", "insideV"))
    grid = f'<w:gridCol w:w="{SP_EINHEIT}"/>' + "".join(f'<w:gridCol w:w="{SP_NIVEAU}"/>' for _ in NIVEAUS)
    kopf = _zelle(SP_EINHEIT, _absatz(_lauf("Unterrichtseinheit", fett=True)), "E7E6E6") + "".join(
        _zelle(SP_NIVEAU, _absatz(_lauf(f"{n} · {NIVEAU_NAME[n]}", fett=True, farbe="FFFFFF")), NIVEAU_FARBE[n])
        for n in NIVEAUS)
    zeilen = [f'<w:tr><w:trPr><w:tblHeader/></w:trPr>{kopf}</w:tr>']
    for z in k["zeilen"]:
        erste = _absatz(_lauf(z["titel"], fett=True)) + _absatz(_lauf(z["wochen"], farbe="666666"))
        if z["notiz"]:
            erste += _absatz(_lauf(z["notiz"], farbe="666666"))
        zellen = "".join(
            _zelle(SP_NIVEAU, "".join(_absatz(_lauf(t, farbe="333333" if lp else None)) for t, lp in z["zellen"][n]))
            for n in NIVEAUS)
        zeilen.append(f"<w:tr>{_zelle(SP_EINHEIT, erste, 'F5F5F5')}{zellen}</w:tr>")
    return (f'<w:tbl><w:tblPr><w:tblW w:w="{NUTZ}" w:type="dxa"/><w:tblLayout w:type="fixed"/>'
            f'<w:tblBorders>{rand}</w:tblBorders><w:tblCellMar><w:left w:w="70" w:type="dxa"/>'
            f'<w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>{grid}</w:tblGrid>'
            + "".join(zeilen) + "</w:tbl>")


def docx(doc: dict, name: str, nur: int | None = None, schrift: str = "Arial") -> bytes:
    teile = [_absatz(_lauf(name, fett=True, groesse=32), nach=60),
             _absatz(_lauf(_untertitel(doc, f"Stand {doc.get('curriculum', {}).get('stand') or '—'}"), farbe="666666"), nach=200)]
    for i, k in enumerate(klassen(doc, nur)):
        teile.append(_absatz(_lauf(f"Klasse {k['klasse']}", fett=True, groesse=28), nach=40, umbruch=i > 0))
        teile.append(_absatz(_lauf(k["kopf"], farbe="666666"), nach=120))
        teile.append(_tabelle(k) if k["zeilen"] else _absatz(_lauf("Keine Unterrichtseinheiten.", farbe="666666")))
    sect = (f'<w:sectPr><w:pgSz w:w="{SEITE_B}" w:h="{SEITE_H}" w:orient="landscape"/>'
            f'<w:pgMar w:top="{RAND}" w:right="{RAND}" w:bottom="{RAND}" w:left="{RAND}" '
            f'w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>')
    dokument = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
                + "".join(teile) + _absatz("") + sect + "</w:body></w:document>")
    stile = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
             f'<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="{schrift}" w:hAnsi="{schrift}" w:cs="{schrift}"/>'
             '<w:sz w:val="17"/><w:szCs w:val="17"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault>'
             '<w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>'
             '</w:docDefaults></w:styles>')
    typen = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
             '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
             '<Default Extension="xml" ContentType="application/xml"/>'
             '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
             '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
             '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>')
    doc_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                '</Relationships>')
    puffer = io.BytesIO()
    with zipfile.ZipFile(puffer, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", typen)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", dokument)
        z.writestr("word/styles.xml", stile)
        z.writestr("word/_rels/document.xml.rels", doc_rels)
    return puffer.getvalue()


def pdf(doc: dict, name: str, nur: int | None = None) -> bytes | None:
    with tempfile.TemporaryDirectory() as tmp:
        quelle = Path(tmp) / "curriculum.docx"
        # Im Container fehlen Arial und Liberation; ohne Ersatz nimmt LibreOffice eine Serifenschrift.
        quelle.write_bytes(docx(doc, name, nur, schrift="DejaVu Sans"))
        ziel = convert_to_pdf(quelle, Path(tmp))
        return ziel.read_bytes() if ziel else None


# ── SVG (eine Klasse) ────────────────────────────────────────────────────────

S_BREITE, S_EINHEIT, S_SCHRIFT, S_ZEILE, S_PAD = 1600, 250, 12, 15, 6
S_NIVEAU = (S_BREITE - S_EINHEIT) / len(NIVEAUS)


def _umbrechen(text: str, breite: float, schrift: int = S_SCHRIFT) -> list[str]:
    zeichen = max(8, int((breite - 2 * S_PAD) / (schrift * 0.53)))
    return textwrap.wrap(text, zeichen, break_long_words=True) or [""]


def _text(x: float, y: float, zeilen: list[tuple[str, dict]]) -> str:
    out = []
    for i, (z, stil) in enumerate(zeilen):
        attr = "".join(f' {k}="{v}"' for k, v in stil.items())
        out.append(f'<text x="{x:.0f}" y="{y + (i + 1) * S_ZEILE - 3:.0f}"{attr}>{escape(z)}</text>')
    return "".join(out)


def svg(doc: dict, name: str, klasse: int) -> bytes:
    ks = klassen(doc, klasse)
    if not ks:
        raise ValueError(f"Klasse {klasse} gibt es nicht")
    k = ks[0]
    teile, y = [], 0
    teile.append(f'<text x="0" y="22" font-size="20" font-weight="bold">{escape(name)} · Klasse {k["klasse"]}</text>')
    teile.append(f'<text x="0" y="42" fill="#666">{escape(k["kopf"])}</text>')
    y = 56
    # Kopfzeile
    kh = S_ZEILE + 2 * S_PAD
    teile.append(f'<rect x="0" y="{y}" width="{S_EINHEIT}" height="{kh}" fill="#E7E6E6" stroke="#BFBFBF"/>')
    teile.append(_text(S_PAD, y + S_PAD, [("Unterrichtseinheit", {"font-weight": "bold"})]))
    for i, n in enumerate(NIVEAUS):
        x = S_EINHEIT + i * S_NIVEAU
        teile.append(f'<rect x="{x:.0f}" y="{y}" width="{S_NIVEAU:.0f}" height="{kh}" fill="#{NIVEAU_FARBE[n]}" stroke="#BFBFBF"/>')
        teile.append(_text(x + S_PAD, y + S_PAD, [(f"{n} · {NIVEAU_NAME[n]}", {"font-weight": "bold", "fill": "#fff"})]))
    y += kh
    for z in k["zeilen"]:
        erste = [(l, {"font-weight": "bold"}) for l in _umbrechen(z["titel"], S_EINHEIT)]
        erste += [(z["wochen"], {"fill": "#666"})] + [(l, {"fill": "#666"}) for l in _umbrechen(z["notiz"], S_EINHEIT) if z["notiz"]]
        spalten = []
        for n in NIVEAUS:
            zeilen = []
            for t, lp in z["zellen"][n]:
                zeilen += [(l, {"fill": "#333"} if lp else {}) for l in _umbrechen(t, S_NIVEAU)]
            spalten.append(zeilen)
        h = max(len(erste), *(len(s) for s in spalten)) * S_ZEILE + 2 * S_PAD
        teile.append(f'<rect x="0" y="{y}" width="{S_EINHEIT}" height="{h}" fill="#F5F5F5" stroke="#BFBFBF"/>')
        teile.append(_text(S_PAD, y + S_PAD, erste))
        for i, (n, zeilen) in enumerate(zip(NIVEAUS, spalten)):
            x = S_EINHEIT + i * S_NIVEAU
            teile.append(f'<rect x="{x:.0f}" y="{y}" width="{S_NIVEAU:.0f}" height="{h}" fill="#{NIVEAU_FARBE[n]}" fill-opacity="0.06" stroke="#BFBFBF"/>')
            teile.append(_text(x + S_PAD, y + S_PAD, zeilen))
        y += h
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{S_BREITE}" height="{y + 2}" '
            f'viewBox="0 -1 {S_BREITE} {y + 3}" font-family="Arial, Helvetica, sans-serif" font-size="{S_SCHRIFT}">'
            f'<rect x="0" y="-1" width="{S_BREITE}" height="{y + 3}" fill="#fff"/>'
            + "".join(teile) + "</svg>").encode("utf-8")
