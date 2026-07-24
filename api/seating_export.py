"""Sitzplan A4 PDF export: builds an SVG the size of an A4 page (in mm) from a
SeatingPlan's stored `items`, then converts it to PDF via headless LibreOffice
in two steps — SVG -> ODG -> PDF.

The intermediate ODG matters: soffice drops a *standalone* SVG onto a default
A4-portrait Draw page and scales it, ignoring the SVG's own mm dimensions — so a
landscape plan came out portrait and mis-sized. LO's SVG->ODG import instead
sizes the Draw page to the drawing, and the subsequent ODG->PDF preserves that.
Item coordinates are in millimetre canvas units matching A4 (landscape 297x210 /
portrait 210x297), so the SVG is a 1:1 render of the on-screen canvas.
"""
import html as html_lib
import subprocess
import tempfile
from pathlib import Path

from .doc_convert import convert_to_pdf, CONVERT_TIMEOUT_SECONDS

# Font sizes in mm — MUST match the frontend (PRIMARY_FONT_MM / CHAIR_FONT_MM),
# so the printout keeps the same text-to-object ratio as the on-screen canvas.
_PRIMARY_FONT_MM = 5.0  # tables + inventory labels
_CHAIR_FONT_MM = 2.6    # chairs (wraps)
PRINT_MARGIN_MM = 5.0   # safe-area border kept clear of the paper edge


def _short(full: str) -> str:
    """"Vorname Nachname" -> "Vorname N." — matches the web's table-seat labels."""
    parts = full.split()
    return f"{parts[0]} {parts[1][0]}." if len(parts) >= 2 else full

# Base item footprints in mm, mirrored on the frontend (BASE_ITEM_SIZES).
# SIZE_FACTOR scales every element relative to the A4 canvas (kept in sync FE/BE).
# seats = number of assignable seats an item exposes.
SIZE_FACTOR = 0.5
ITEM_SIZES: dict[str, dict] = {
    "table1":     {"w": 40,  "h": 40, "seats": 1},
    "table2":     {"w": 100, "h": 40, "seats": 2},
    "teacher":    {"w": 100, "h": 40, "seats": 0},
    "chair":      {"w": 30,  "h": 30, "seats": 1},
    "cabinet":    {"w": 60,  "h": 30, "seats": 0},
    "board":      {"w": 150, "h": 10, "seats": 0},
    "smartboard": {"w": 150, "h": 10, "seats": 0},
    "custom":     {"w": 50,  "h": 30, "seats": 0},
}

KIND_LABELS: dict[str, str] = {
    "teacher": "Lehrertisch",
    "chair": "Stuhl",
    "cabinet": "Schrank",
    "board": "Tafel",
    "smartboard": "Smartboard",
}

_FILL = {
    "table1": "#eef2ff", "table2": "#eef2ff",
    "teacher": "#fef3c7", "chair": "#e0f2fe", "cabinet": "#f3f4f6",
    "board": "#e5e7eb", "smartboard": "#e0e7ff", "custom": "#f3f4f6",
}
_STROKE = "#9ca3af"


def _esc(s: str) -> str:
    return html_lib.escape(s or "")


def _clip_attr(clip: str | None) -> str:
    return f' clip-path="url(#{clip})"' if clip else ""


def _text(x: float, y: float, s: str, size: float, *, weight: str = "normal", fill: str = "#1f2937", clip: str | None = None) -> str:
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size:.1f}" '
        f'font-family="Segoe UI, Arial, sans-serif" font-weight="{weight}" '
        f'fill="{fill}" text-anchor="middle" dominant-baseline="middle"{_clip_attr(clip)}>{_esc(s)}</text>'
    )


def _text_multiline(x: float, y: float, lines: list[str], size: float, *, weight: str = "600", fill: str = "#1f2937", clip: str | None = None) -> str:
    """Center a few short lines around (x, y) — used for chair seat labels so a
    full name wraps instead of overflowing the small square."""
    if not lines:
        return ""
    lh = size * 1.05
    first_dy = -((len(lines) - 1) / 2) * lh
    spans = "".join(
        f'<tspan x="{x:.1f}" dy="{(first_dy if i == 0 else lh):.2f}">{_esc(ln)}</tspan>'
        for i, ln in enumerate(lines)
    )
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size:.1f}" '
        f'font-family="Segoe UI, Arial, sans-serif" font-weight="{weight}" '
        f'fill="{fill}" text-anchor="middle" dominant-baseline="middle"{_clip_attr(clip)}>{spans}</text>'
    )


def _item_svg(item: dict, student_names: dict[int, str], student_short: dict[int, str]) -> str:
    kind = item.get("kind", "custom")
    item_id = str(item.get("id", "0")).replace(" ", "_")
    size = ITEM_SIZES.get(kind, ITEM_SIZES["custom"])
    # per-axis scale (legacy uniform `scale` honored as a fallback)
    legacy = float(item.get("scale", 1) or 1)
    sx = float(item.get("scaleX", legacy) or 1)
    sy = float(item.get("scaleY", legacy) or 1)
    w, h = float(size["w"]) * SIZE_FACTOR * sx, float(size["h"]) * SIZE_FACTOR * sy
    x, y = float(item.get("x", 0)), float(item.get("y", 0))
    rot = float(item.get("rotation", 0))
    cx, cy = x + w / 2, y + h / 2

    parts = [f'<g transform="rotate({rot:.1f} {cx:.1f} {cy:.1f})">']
    parts.append(
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="2.5" '
        f'fill="{_FILL.get(kind, "#f3f4f6")}" stroke="{_STROKE}" stroke-width="0.4"/>'
    )

    seats = item.get("seats") or []
    if seats:
        # Split the desk width evenly across its seats; name (or empty) per seat.
        n = len(seats)
        seat_w = w / n
        for i, seat in enumerate(seats):
            seat_x0 = x + w * i / n
            seat_cx = seat_x0 + seat_w / 2
            sid = seat.get("student_id")
            if sid is not None:
                # chairs show the full name (they wrap); tables use short names
                name = student_names.get(sid, "") if kind == "chair" else (student_short or {}).get(sid) or _short(student_names.get(sid, ""))
            else:
                name = seat.get("label") or ""
            if n > 1 and i > 0:
                parts.append(f'<line x1="{seat_x0:.1f}" y1="{y:.1f}" x2="{seat_x0:.1f}" y2="{y + h:.1f}" stroke="{_STROKE}" stroke-width="0.3"/>')
            # Clip each seat's text to its own cell so long names/labels don't
            # overflow or overlap the neighbour (matches the web's overflow:hidden).
            clip = f"clip-{item_id}-{i}"
            parts.append(f'<clipPath id="{clip}"><rect x="{seat_x0:.1f}" y="{y:.1f}" width="{seat_w:.1f}" height="{h:.1f}"/></clipPath>')
            if kind == "chair":
                lines = (name.split() or [])[:3]
                parts.append(_text_multiline(seat_cx, cy, lines, _CHAIR_FONT_MM, weight="600", clip=clip))
            else:
                parts.append(_text(seat_cx, cy, name, _PRIMARY_FONT_MM, weight="600", clip=clip))
    else:
        label = item.get("label") or KIND_LABELS.get(kind, "")
        if label:
            parts.append(_text(cx, cy, label, _PRIMARY_FONT_MM, fill="#6b7280"))

    parts.append("</g>")
    return "".join(parts)


def build_svg(plan, student_names: dict[int, str], student_short: dict[int, str] | None = None) -> str:
    """Build an A4-sized SVG (units = mm) from a SeatingPlan-like object with
    `.orientation` and `.items`. `student_short` gives table-seat short names;
    when omitted they are derived from `student_names`."""
    if plan.orientation == "portrait":
        pw, ph = 210, 297
    else:
        pw, ph = 297, 210

    short = student_short or {}
    body = "".join(_item_svg(it, student_names, short) for it in (plan.items or []))
    m = PRINT_MARGIN_MM
    # 5 mm safe-area frame (printers can't reach the paper edge)
    border = (
        f'<rect x="{m}" y="{m}" width="{pw - 2 * m}" height="{ph - 2 * m}" '
        f'fill="none" stroke="#d1d5db" stroke-width="0.3" stroke-dasharray="2 2"/>'
    )
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{pw}mm" height="{ph}mm" '
        f'viewBox="0 0 {pw} {ph}">'
        f'<rect x="0" y="0" width="{pw}" height="{ph}" fill="#ffffff"/>'
        f'{border}'
        f'{body}'
        f'</svg>'
    )


def _svg_to_odg(svg_path: Path, out_dir: Path) -> Path | None:
    """Convert an SVG to ODG via headless LibreOffice. LO's SVG import sizes the
    Draw page to the drawing (so a landscape drawing yields a landscape page) —
    the direct SVG->PDF path instead forces a default portrait A4."""
    try:
        subprocess.run(
            ["soffice", "--headless", "--convert-to", "odg", "--outdir", str(out_dir), str(svg_path)],
            capture_output=True, timeout=CONVERT_TIMEOUT_SECONDS, check=True,
        )
    except Exception:
        return None
    odg = out_dir / (svg_path.stem + ".odg")
    return odg if odg.exists() else None


def export_pdf(plan, student_names: dict[int, str], student_short: dict[int, str] | None = None) -> Path | None:
    """Returns a PDF path inside a fresh temp directory, or None if the
    LibreOffice conversion failed/is unavailable (caller should 503).

    Two-step SVG -> ODG -> PDF: the intermediate ODG carries the page size LO
    derives from the drawing, so orientation and scale are preserved (a direct
    SVG -> PDF drops the drawing onto a default portrait A4 and mis-sizes it)."""
    svg = build_svg(plan, student_names, student_short)
    tmp_dir = Path(tempfile.mkdtemp(prefix="seating_export_"))
    svg_path = tmp_dir / "sitzplan.svg"
    svg_path.write_text(svg, encoding="utf-8")
    odg_path = _svg_to_odg(svg_path, tmp_dir)
    if odg_path is None:
        return None
    return convert_to_pdf(odg_path, tmp_dir)
