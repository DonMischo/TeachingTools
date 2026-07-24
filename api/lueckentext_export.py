"""Lückentext PDF export: renders a styled HTML worksheet, then reuses
doc_convert's headless-LibreOffice HTML -> PDF conversion (no pypandoc/docx
round-trip — HTML gives direct control over gap width and layout, which a
markdown->docx pipeline can't).

The blank ("Arbeitsblatt") export bundles all three support levels into one
PDF, one page-break-separated section per level, so a teacher can print one
document and hand out the right page per student:
  Stufe 1 - Wortbank:              word list shown, gaps sized to word length
  Stufe 2 - Anzahl der Buchstaben: gaps sized to word length, no word list
  Stufe 3 - Ohne Hilfen:           one uniform blank for every gap, no length or word-list cue
Multiple-choice gaps show their options inline at every level, since a paper
worksheet can't be interactive — the options ARE the gap type on paper.
"""
import html as html_lib
import random
import re
import tempfile
from pathlib import Path

from .doc_convert import convert_to_pdf

_GAP_RE = re.compile(r"\{\{([^{}]+)\}\}")

_STAGES = [
    ("wordbank", "Stufe 1 – Wortbank", "Nutze die Wörter aus der Wortbank, um die Lücken zu füllen."),
    ("letters", "Stufe 2 – Anzahl der Buchstaben", "Die Länge jeder Lücke verrät dir, wie viele Buchstaben das gesuchte Wort hat."),
    ("hard", "Stufe 3 – Ohne Hilfen", "Fülle die Lücken ohne weitere Hinweise."),
]

# Stufe 3 has no length cue at all: every gap gets the same single long blank,
# generous enough for handwriting, regardless of the real answer's length.
_HARD_STAGE_GAP_LENGTH = 16

# LibreOffice's HTML importer (used by doc_convert.convert_to_pdf) is not a
# full browser engine: it drops empty inline elements entirely (an empty
# <span> with only a border-bottom renders as nothing), and it paints a
# wrapped block's background/border per visual line instead of as one
# continuous box (border-radius then looks like separate stretched pills).
# So gaps are rendered as literal underscore characters (real, always-visible
# content) rather than an empty bordered box, and the word bank is a
# single-cell table (a box LO's HTML filter reliably paints as one shape)
# instead of a div with border-radius.
_CSS = """
<style>
  @page { margin: 2.2cm 2cm; }
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: #1f2937; line-height: 2; }
  h1 { font-size: 21pt; color: #5b21b6; margin: 0 0 0.1em; }
  .subtitle { color: #6b7280; font-size: 10.5pt; margin: 0 0 1.3em; }
  .stage { page-break-before: always; }
  .stage:first-of-type { page-break-before: avoid; }
  .stage-title { font-size: 15pt; color: #6d28d9; border-bottom: 2px solid #ddd6fe; padding-bottom: 5px; margin: 0 0 4px; }
  .stage-desc { color: #6b7280; font-size: 9.5pt; margin: 0 0 1em; }
  .wordbank-table { width: 100%; border-collapse: collapse; margin: 0 0 1.2em; }
  .wordbank-table td { background: #f5f3ff; border: 1px solid #ddd6fe; padding: 10px 14px; font-size: 11pt; }
  .wordbank-table .label { color: #6d28d9; font-weight: 700; }
  .body-text { font-size: 12.5pt; }
  .gap { font-weight: 700; color: #6d28d9; letter-spacing: 5px; margin: 0 2px; }
  .gap.filled { color: #16a34a; letter-spacing: normal; margin: 0; }
  .choices { font-size: 9pt; color: #6b7280; }
</style>
"""


def _blank_span(answer: str, mode: str) -> str:
    n = max(len(answer), 1) if mode in ("wordbank", "letters") else _HARD_STAGE_GAP_LENGTH
    return f'<span class="gap">{"_" * n}</span>'


def _filled_span(text: str) -> str:
    return f'<span class="gap filled">{html_lib.escape(text)}</span>'


def _choices_note(choices: list[str] | None) -> str:
    if not choices:
        return ""
    return f' <span class="choices">({" / ".join(html_lib.escape(c) for c in choices)})</span>'


def _render_body(text: str, gaps_by_id: dict, mode: str, given_answers: dict[str, str] | None = None) -> str:
    escaped = html_lib.escape(text)

    def _sub(m: re.Match) -> str:
        gid = m.group(1)
        gap = gaps_by_id.get(gid)
        if not gap:
            return m.group(0)
        if mode == "filled":
            shown = (given_answers or {}).get(gid) or gap["answer"]
            return _filled_span(shown)
        span = _blank_span(gap["answer"], mode)
        if gap.get("type") == "multiple_choice":
            span += _choices_note(gap.get("choices"))
        return span

    return _GAP_RE.sub(_sub, escaped)


def _word_bank_list(lset) -> list[str]:
    words = [g["answer"] for g in lset.gaps]
    words += list(getattr(lset, "distractors", None) or [])
    random.shuffle(words)
    return words


def build_html(lset, filled: bool, given_answers: dict[str, str] | None = None) -> str:
    gaps_by_id = {g["id"]: g for g in lset.gaps}
    title_html = html_lib.escape(lset.title)
    description = getattr(lset, "description", None)
    subtitle_html = f'<p class="subtitle">{html_lib.escape(description)}</p>' if description else ""

    if filled:
        body = _render_body(lset.text, gaps_by_id, "filled", given_answers)
        sections = f'<div class="stage"><p class="body-text">{body}</p></div>'
    else:
        parts = []
        for mode, stage_title, stage_desc in _STAGES:
            body = _render_body(lset.text, gaps_by_id, mode)
            wordbank_html = ""
            if mode == "wordbank":
                words_html = " • ".join(html_lib.escape(w) for w in _word_bank_list(lset))
                wordbank_html = (
                    '<table class="wordbank-table"><tr><td>'
                    f'<span class="label">Wortbank:</span> {words_html}'
                    '</td></tr></table>'
                )
            parts.append(
                f'<div class="stage">'
                f'<h2 class="stage-title">{html_lib.escape(stage_title)}</h2>'
                f'<p class="stage-desc">{html_lib.escape(stage_desc)}</p>'
                f'{wordbank_html}'
                f'<p class="body-text">{body}</p>'
                f'</div>'
            )
        sections = "".join(parts)

    return (
        f'<!doctype html><html><head><meta charset="utf-8">{_CSS}</head><body>'
        f'<h1>{title_html}</h1>{subtitle_html}{sections}'
        f'</body></html>'
    )


def export_pdf(lset, filled: bool, given_answers: dict[str, str] | None = None) -> Path | None:
    """Returns a PDF path inside a fresh temp directory, or None if the
    LibreOffice conversion failed/is unavailable (caller should 503)."""
    html_doc = build_html(lset, filled=filled, given_answers=given_answers)
    tmp_dir = Path(tempfile.mkdtemp(prefix="lueckentext_export_"))
    html_path = tmp_dir / "export.html"
    html_path.write_text(html_doc, encoding="utf-8")
    return convert_to_pdf(html_path, tmp_dir)
