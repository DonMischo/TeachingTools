"""
Whitelisted task-generator library — procedurally generated practice tasks
for the Übungsseite, and a content source for other tools (Caputh, Bingo,
TaskCrawler) via GET /api/generators/{id}/sample.

Coverage maps to the Thüringer Lehrplan Mathematik Kl. 1-7 (Grundschule +
Regelschule): Grundrechenarten (1-4), Größen (3-5), Geometrie (4-7, mit
SVG-Skizzen), Brüche (6), Stochastik (6-7, mit SVG), Prozent (7),
Zuordnungen/Dreisatz (6-7), lineare Gleichungen und Funktionen (7).

Security contract: uploaded/authored JSON NEVER carries executable code.
Content may only *reference* a generator by its registry id plus plain
numeric/string params; the functions themselves live here, in reviewed
repo code. Params are clamped server-side. This is what keeps procedural
tasks free of injection surface — never add eval()/exec() of content-
supplied strings to this module.

Adding a topic = registering one GeneratorDescriptor here:
  - id: stable slug referenced by content and stored in practice progress
    rows — never rename once in use.
  - label/subject/description/grades: shown in topic lists and used for
    filtering.
  - generate(difficulty, rng) -> dict with:
      question   str, KaTeX-fähig ($...$/$$...$$)
      accept     list[str] of accepted answers (checked case-insensitively,
                 numerically tolerant, comma or point decimal — see
                 check_input_answer). Fractions as canonical "a/b".
      hint       str (optional)
      solution   str (optional, shown after wrong answers)
      image_svg  str (optional) — self-contained inline SVG using
                 currentColor for strokes/text so it works in every theme
      distractors list[str] (optional) — plausible wrong answers, lets
                 Caputh/Bingo build multiple-choice content from the same
                 generator (see /api/generators/{id}/sample)
    difficulty is 1 (easiest) to 5 (hardest); rng is a seeded
    random.Random — use ONLY this rng (no global random) so a stored
    task can never disagree with its check. Answers must be clean
    (integers or short decimals/fractions) at every level.

For subjects where procedural generation doesn't pay off (most non-math/
physics topics), authored question pools (TaskCrawler `task.variants`, or a
future pool-backed generator that just draws from a JSON list) are the
better tool — a generator is only worth it when parameters genuinely vary.
"""
import math
import random
from dataclasses import dataclass, field
from math import gcd
from typing import Callable

DIFFICULTY_MIN = 1
DIFFICULTY_MAX = 5


def check_input_answer(accept: list, given) -> bool:
    """Shared free-text/number answer check: case-insensitive, trimmed,
    comma or point decimals, small numeric tolerance. Used by the TaskCrawler
    events endpoint and the practice router so both check identically."""
    accepted = [str(a).strip().lower() for a in accept]
    given_raw = str(given).strip().lower()
    if given_raw in accepted:
        return True
    try:
        given_f = float(given_raw.replace(",", "."))
    except ValueError:
        return False
    for a in accepted:
        try:
            if abs(float(a.replace(",", ".")) - given_f) < 1e-9:
                return True
        except ValueError:
            continue
    return False


@dataclass
class GeneratorDescriptor:
    id: str
    label: str
    subject: str
    description: str
    generate: Callable[[int, random.Random], dict]
    grades: list[int] = field(default_factory=list)


def _fmt_num(v: float) -> str:
    """Render 4.0 as '4', 4.5 as '4,5' (German decimal comma for display)."""
    if float(v).is_integer():
        return str(int(v))
    return f"{v}".replace(".", ",")


def _frac(numerator: int, denominator: int) -> str:
    """Canonical reduced fraction string 'a/b' (or integer if it divides)."""
    g = gcd(numerator, denominator)
    n, d = numerator // g, denominator // g
    return str(n) if d == 1 else f"{n}/{d}"


def _frac_accepts(numerator: int, denominator: int) -> list[str]:
    """Reduced fraction plus its decimal form when it terminates shortly."""
    accepts = [_frac(numerator, denominator)]
    dec = numerator / denominator
    if not float(dec).is_integer() and round(dec, 3) == dec:
        accepts += [str(dec), str(dec).replace(".", ",")]
    return accepts


def _distinct(rng: random.Random, candidates: list, answer: str, n: int = 3) -> list[str]:
    """Up to n plausible wrong answers, deduped, never equal to the answer."""
    out: list[str] = []
    for c in candidates:
        s = str(c)
        if s != answer and s not in out:
            out.append(s)
    rng.shuffle(out)
    return out[:n]


# ---------------------------------------------------------------------------
# SVG helpers — self-contained, theme-aware (currentColor strokes/text)
# ---------------------------------------------------------------------------

def _svg(w: int, h: int, inner: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'width="{w}" height="{h}" fill="none" stroke="currentColor" '
        f'font-family="system-ui, sans-serif" font-size="15">{inner}</svg>'
    )


def _txt(x: float, y: float, s: str, anchor: str = "middle") -> str:
    return f'<text x="{x}" y="{y}" fill="currentColor" stroke="none" text-anchor="{anchor}">{s}</text>'


def svg_rectangle(a: float, b: float, unit: str = "cm", label_a: str | None = None, label_b: str | None = None) -> str:
    """Labeled rectangle, wider side horizontal. label_a/label_b override the
    displayed text (e.g. "?") while a/b still control the drawn proportions."""
    text_a = label_a if label_a is not None else f"{_fmt_num(a)} {unit}"
    text_b = label_b if label_b is not None else f"{_fmt_num(b)} {unit}"
    inner = (
        f'<rect x="30" y="20" width="200" height="120" stroke-width="2" fill="rgba(99,102,241,0.12)"/>'
        + _txt(130, 165, text_a)
        + _txt(250, 85, text_b, "start")
    )
    return _svg(320, 180, inner)


def svg_triangle_base_height(g: float, h: float, unit: str = "cm") -> str:
    """Triangle with base g and dashed height h."""
    inner = (
        f'<polygon points="20,150 260,150 150,30" stroke-width="2" fill="rgba(34,197,94,0.12)"/>'
        f'<line x1="150" y1="150" x2="150" y2="30" stroke-dasharray="6 4"/>'
        + _txt(140, 172, f"g = {_fmt_num(g)} {unit}")
        + _txt(160, 95, f"h = {_fmt_num(h)} {unit}", "start")
    )
    return _svg(300, 185, inner)


def svg_triangle_angles(alpha: int, beta: int) -> str:
    """Triangle with two labeled angles and gamma = ? at the top."""
    inner = (
        f'<polygon points="25,150 275,150 160,35" stroke-width="2" fill="rgba(249,115,22,0.10)"/>'
        + _txt(55, 142, f"α = {alpha}°", "start")
        + _txt(245, 142, f"β = {beta}°", "end")
        + _txt(160, 62, "γ = ?")
    )
    return _svg(300, 175, inner)


def svg_cuboid(
    a: float, b: float, c: float, unit: str = "cm",
    label_a: str | None = None, label_b: str | None = None, label_c: str | None = None,
) -> str:
    """Oblique-projection cuboid labeled a (width), b (depth), c (height).
    label_a/b/c override the displayed text (e.g. "?") for reverse-calc tasks."""
    text_a = label_a if label_a is not None else f"a = {_fmt_num(a)} {unit}"
    text_b = label_b if label_b is not None else f"b = {_fmt_num(b)} {unit}"
    text_c = label_c if label_c is not None else f"c = {_fmt_num(c)} {unit}"
    # shifted +20px right of the original drawing so the "c" label has room
    # to grow leftward without leaving the viewBox
    inner = (
        # front face, top face, side face
        f'<rect x="50" y="70" width="160" height="90" stroke-width="2" fill="rgba(59,130,246,0.10)"/>'
        f'<polygon points="50,70 100,30 260,30 210,70" stroke-width="2" fill="rgba(59,130,246,0.16)"/>'
        f'<polygon points="210,70 260,30 260,120 210,160" stroke-width="2" fill="rgba(59,130,246,0.22)"/>'
        + _txt(130, 180, text_a)
        + _txt(270, 62, text_b, "start")
        + _txt(5, 120, text_c, "start")
    )
    return _svg(360, 195, inner)


def svg_urn(red: int, blue: int) -> str:
    """Urn with red/blue balls in a grid, resting at the bottom of the tub."""
    colors = ["#ef4444"] * red + ["#3b82f6"] * blue
    rows = (len(colors) + 5) // 6
    height = 55 + rows * 38 + 15
    balls = []
    for i, color in enumerate(colors):
        row_from_top = i // 6
        row_from_bottom = rows - 1 - row_from_top
        cx = 45 + (i % 6) * 38
        cy = height - 20 - row_from_bottom * 38
        balls.append(f'<circle cx="{cx}" cy="{cy}" r="15" fill="{color}" stroke="none"/>')
    tub = f'<path d="M 18 20 L 26 {height - 8} Q 26 {height} 40 {height} L {45 + 5 * 38 + 20} {height} Q {45 + 5 * 38 + 34} {height} {45 + 5 * 38 + 34} {height - 8} L {45 + 5 * 38 + 42} 20" stroke-width="2"/>'
    return _svg(45 + 5 * 38 + 60, height + 12, tub + "".join(balls))


def svg_die(value: int) -> str:
    """Single die face with pips."""
    pip_layout = {
        1: [(60, 60)],
        2: [(35, 35), (85, 85)],
        3: [(35, 35), (60, 60), (85, 85)],
        4: [(35, 35), (85, 35), (35, 85), (85, 85)],
        5: [(35, 35), (85, 35), (60, 60), (35, 85), (85, 85)],
        6: [(35, 30), (85, 30), (35, 60), (85, 60), (35, 90), (85, 90)],
    }
    pips = "".join(f'<circle cx="{x}" cy="{y}" r="8" fill="currentColor" stroke="none"/>' for x, y in pip_layout[value])
    return _svg(120, 120, f'<rect x="10" y="10" width="100" height="100" rx="16" stroke-width="2.5"/>{pips}')


def svg_spinner(colors: list[str]) -> str:
    """Glücksrad (spinner) split into equal wedges, one per color hex."""
    cx, cy, r = 80, 80, 65
    n = len(colors)
    wedges = []
    for i, color in enumerate(colors):
        a0 = -math.pi / 2 + 2 * math.pi * i / n
        a1 = -math.pi / 2 + 2 * math.pi * (i + 1) / n
        x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
        x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
        large_arc = 1 if (a1 - a0) > math.pi else 0
        wedges.append(
            f'<path d="M {cx} {cy} L {x0:.1f} {y0:.1f} A {r} {r} 0 {large_arc} 1 {x1:.1f} {y1:.1f} Z" '
            f'fill="{color}" stroke="currentColor" stroke-width="1.5"/>'
        )
    return _svg(160, 160, "".join(wedges) + f'<circle cx="{cx}" cy="{cy}" r="4" fill="currentColor" stroke="none"/>')


# ---------------------------------------------------------------------------
# mathe Kl. 1-4: Grundrechenarten
# ---------------------------------------------------------------------------

def _gen_grundrechenarten(difficulty: int, rng: random.Random) -> dict:
    """1: +/− bis 20 (auch fehlender Summand) · 2: +/− bis 100 · 3: Einmaleins
    (auch fehlender Faktor) · 4: Division/bis 1000 · 5: Mix aus allem — +/−
    bis 1000, kleines Einmaleins, Division, Punkt-vor-Strich, verkettete
    Terme — sodass am Schwierigkeits-Deckel nicht immer derselbe Aufgabentyp
    mit denselben kleinen Zahlen kommt."""
    if difficulty <= 1:
        def _add_sub(rng):
            a, b = rng.randint(2, 15), rng.randint(2, 15)
            if rng.random() < 0.5:
                expr, ans = f"{a} + {b}", a + b
            else:
                a, b = max(a, b), min(a, b)
                expr, ans = f"{a} - {b}", a - b
            return f"Rechne aus: $${expr} = ?$$", ans, "Rechne Schritt für Schritt, z.B. erst bis zur 10."

        def _missing_addend(rng):
            a, b = rng.randint(2, 15), rng.randint(2, 15)
            c = a + b
            return (f"Rechne aus: $${a} + ? = {c}$$", b,
                    f"Wie viel muss zu {a} dazukommen, um {c} zu erhalten?")

        question, ans, hint = rng.choice([_add_sub, _missing_addend])(rng)
    elif difficulty == 2:
        a, b = rng.randint(15, 80), rng.randint(11, 19)
        if rng.random() < 0.5:
            expr, ans = f"{a} + {b}", a + b
        else:
            expr, ans = f"{a} - {b}", a - b
        question = f"Rechne aus: $${expr} = ?$$"
        hint = "Zerlege die zweite Zahl in Zehner und Einer."
    elif difficulty == 3:
        def _mul(rng):
            a, b = rng.randint(3, 9), rng.randint(3, 9)
            return f"Rechne aus: $${a} \\cdot {b} = ?$$", a * b, f"Nutze das Einmaleins der {a}."

        def _missing_factor(rng):
            a, x = rng.randint(3, 9), rng.randint(3, 9)
            c = a * x
            return (f"Rechne aus: $${a} \\cdot ? = {c}$$", x,
                    f"Welche Zahl mal {a} ergibt {c}?")

        question, ans, hint = rng.choice([_mul, _missing_factor])(rng)
    elif difficulty == 4:
        b = rng.randint(3, 9)
        ans = rng.randint(4, 12)
        question = f"Rechne aus: $${b * ans} : {b} = ?$$"
        hint = f"Welche Zahl mal {b} ergibt {b * ans}?"
    else:
        def _big_add_sub(rng):
            a, b = rng.randint(100, 800), rng.randint(50, 400)
            if rng.random() < 0.5:
                expr, ans = f"{a} + {b}", a + b
            else:
                a, b = max(a, b), min(a, b)
                expr, ans = f"{a} - {b}", a - b
            return f"Rechne aus: $${expr} = ?$$", ans, "Zerlege in Hunderter, Zehner und Einer."

        def _missing_addend_big(rng):
            a, b = rng.randint(100, 800), rng.randint(50, 400)
            c = a + b
            return (f"Rechne aus: $${a} + ? = {c}$$", b,
                    f"Wie viel muss zu {a} dazukommen, um {c} zu erhalten?")

        def _mul_small(rng):
            a, b = rng.randint(3, 9), rng.randint(3, 9)
            return f"Rechne aus: $${a} \\cdot {b} = ?$$", a * b, f"Nutze das Einmaleins der {a}."

        def _missing_factor_small(rng):
            a, x = rng.randint(3, 9), rng.randint(3, 9)
            c = a * x
            return (f"Rechne aus: $${a} \\cdot ? = {c}$$", x,
                    f"Welche Zahl mal {a} ergibt {c}?")

        def _division_big(rng):
            b = rng.randint(3, 9)
            ans = rng.randint(10, 111)
            return f"Rechne aus: $${b * ans} : {b} = ?$$", ans, f"Welche Zahl mal {b} ergibt {b * ans}?"

        def _order_add_first(rng):
            a, b, c = rng.randint(2, 9), rng.randint(2, 9), rng.randint(2, 9)
            return (f"Rechne aus: $${a} + {b} \\cdot {c} = ?$$", a + b * c,
                    "Punktrechnung vor Strichrechnung: erst malnehmen, dann addieren.")

        def _order_mul_first(rng):
            a, b, c = rng.randint(2, 9), rng.randint(2, 9), rng.randint(2, 9)
            return (f"Rechne aus: $${a} \\cdot {b} + {c} = ?$$", a * b + c,
                    "Punktrechnung vor Strichrechnung: erst malnehmen, dann addieren.")

        def _chained_terms(rng):
            a, b, c, d = rng.randint(2, 9), rng.randint(2, 9), rng.randint(2, 9), rng.randint(2, 9)
            return (f"Rechne aus: $${a} \\cdot {b} + {c} \\cdot {d} = ?$$", a * b + c * d,
                    "Erst beide Malaufgaben rechnen, dann die Ergebnisse addieren.")

        question, ans, hint = rng.choice([
            _big_add_sub, _missing_addend_big, _mul_small, _missing_factor_small,
            _division_big, _order_add_first, _order_mul_first, _chained_terms,
        ])(rng)
    answer = str(ans)
    return {
        "question": question,
        "accept": [answer], "hint": hint, "solution": answer,
        "distractors": _distinct(rng, [ans + 1, ans - 1, ans + 10, ans - 10], answer),
    }


# ---------------------------------------------------------------------------
# mathe Kl. 3-5: Größen umrechnen
# ---------------------------------------------------------------------------

def _gen_groessen(difficulty: int, rng: random.Random) -> dict:
    """1: m/kg/€/l-Basics (auch rückwärts) · 2: km/h/min (auch rückwärts) ·
    3: gemischte Angaben · 4: Dezimal rückwärts · 5: Rechnen mit Größen."""
    if difficulty <= 1:
        kinds = [("m", "cm", 100), ("kg", "g", 1000), ("€", "ct", 100), ("l", "ml", 1000)]

        def _big_to_small(rng):
            kind = rng.choice(kinds)
            a = rng.randint(2, 9)
            ans = a * kind[2]
            question = f"Rechne um: $${a}\\ \\text{{{kind[0]}}} = \\, ?\\ \\text{{{kind[1]}}}$$"
            return question, ans, f"1 {kind[0]} = {kind[2]} {kind[1]}."

        def _small_to_big(rng):
            kind = rng.choice(kinds)
            a = rng.randint(2, 9)
            raw = a * kind[2]
            question = f"Rechne um: $${raw}\\ \\text{{{kind[1]}}} = \\, ?\\ \\text{{{kind[0]}}}$$"
            return question, a, f"1 {kind[0]} = {kind[2]} {kind[1]}."

        question, ans, hint = rng.choice([_big_to_small, _small_to_big])(rng)
    elif difficulty == 2:
        kinds = [("km", "m", 1000), ("h", "min", 60), ("min", "s", 60)]

        def _big_to_small(rng):
            kind = rng.choice(kinds)
            a = rng.randint(2, 12)
            ans = a * kind[2]
            question = f"Rechne um: $${a}\\ \\text{{{kind[0]}}} = \\, ?\\ \\text{{{kind[1]}}}$$"
            return question, ans, f"1 {kind[0]} = {kind[2]} {kind[1]}."

        def _small_to_big(rng):
            kind = rng.choice(kinds)
            a = rng.randint(2, 12)
            raw = a * kind[2]
            question = f"Rechne um: $${raw}\\ \\text{{{kind[1]}}} = \\, ?\\ \\text{{{kind[0]}}}$$"
            return question, a, f"1 {kind[0]} = {kind[2]} {kind[1]}."

        question, ans, hint = rng.choice([_big_to_small, _small_to_big])(rng)
    elif difficulty == 3:
        kind = rng.choice([("m", "cm", 100), ("h", "min", 60)])
        big, small = rng.randint(1, 5), rng.randint(5, kind[2] - 5)
        ans = big * kind[2] + small
        question = (f"Rechne um: $${big}\\ \\text{{{kind[0]}}}\\ {small}\\ \\text{{{kind[1]}}}"
                     f" = \\, ?\\ \\text{{{kind[1]}}}$$")
        hint = f"Erst {big} {kind[0]} in {kind[1]} umrechnen, dann die {small} {kind[1]} dazuzählen."
    elif difficulty == 4:
        kind = rng.choice([("g", "kg", 1000), ("m", "km", 1000), ("cm", "m", 100)])
        whole = rng.randint(1, 8)
        part = rng.choice([kind[2] // 4, kind[2] // 2, 3 * kind[2] // 4])
        raw = whole * kind[2] + part
        ans = raw / kind[2]
        question = f"Rechne um: $${raw}\\ \\text{{{kind[0]}}} = \\, ?\\ \\text{{{kind[1]}}}$$"
        hint = f"Teile durch {kind[2]} — das Ergebnis ist eine Kommazahl."
    else:
        n = rng.randint(3, 6)
        g = rng.choice([250, 125, 500, 750])
        ans = n * g
        question = (f"Ein Paket wiegt $${g}\\ \\text{{g}}$$ Wie viel wiegen ${n}$ Pakete zusammen (in g)?")
        hint = f"Rechne {n} mal {g} g."
    answer = _fmt_num(ans) if isinstance(ans, float) else str(ans)
    return {"question": question, "accept": [answer], "hint": hint, "solution": answer}


# ---------------------------------------------------------------------------
# mathe Kl. 6: Brüche
# ---------------------------------------------------------------------------

def _gen_brueche(difficulty: int, rng: random.Random) -> dict:
    """1: Bruch von Menge (auch rückwärts: Ganzes gesucht) · 2: gleichnamig
    addieren · 3: kürzen · 4: ungleichnamig addieren · 5: multiplizieren."""
    if difficulty <= 1:
        def _fraction_of_whole(rng):
            d = rng.choice([2, 3, 4, 5])
            n = rng.randint(1, d - 1)
            whole = d * rng.randint(2, 8)
            ans = whole * n // d
            question = f"Wie viel ist $$\\frac{{{n}}}{{{d}}} \\text{{ von }} {whole}?$$"
            return question, ans, f"Teile {whole} durch {d}, dann mal {n}."

        def _whole_from_fraction(rng):
            d = rng.choice([2, 3, 4, 5])
            n = rng.randint(1, d - 1)
            whole = d * rng.randint(2, 8)
            part = whole * n // d
            question = (f"$$\\frac{{{n}}}{{{d}}}$$ einer Zahl sind ${part}$. "
                        "Wie groß ist die ganze Zahl?")
            return question, whole, f"Teile {part} durch {n}, dann mal {d}."

        question, ans, hint = rng.choice([_fraction_of_whole, _whole_from_fraction])(rng)
        return {"question": question, "accept": [str(ans)], "hint": hint, "solution": str(ans)}
    if difficulty == 2:
        d = rng.choice([5, 7, 8, 9, 10])
        a = rng.randint(1, d - 2)
        b = rng.randint(1, d - a - 1)
        answer = _frac(a + b, d)
        question = f"Addiere (vollständig gekürzt): $$\\frac{{{a}}}{{{d}}} + \\frac{{{b}}}{{{d}}} = ?$$"
        hint = "Gleiche Nenner: nur die Zähler addieren — dann kürzen."
        return {"question": question, "accept": _frac_accepts(a + b, d), "hint": hint, "solution": answer}
    if difficulty == 3:
        base_n, base_d = rng.choice([(1, 2), (2, 3), (3, 4), (1, 3), (2, 5), (3, 5)])
        k = rng.randint(2, 6)
        answer = _frac(base_n, base_d)
        question = f"Kürze vollständig: $$\\frac{{{base_n * k}}}{{{base_d * k}}} = ?$$"
        hint = f"Zähler und Nenner haben den gemeinsamen Teiler {k}."
        return {"question": question, "accept": _frac_accepts(base_n, base_d), "hint": hint, "solution": answer}
    if difficulty == 4:
        d1, d2 = rng.choice([(2, 3), (3, 4), (2, 5), (4, 6), (3, 6)])
        a, b = rng.randint(1, d1 - 1), rng.randint(1, d2 - 1)
        num = a * d2 + b * d1
        den = d1 * d2
        answer = _frac(num, den)
        question = f"Addiere (vollständig gekürzt): $$\\frac{{{a}}}{{{d1}}} + \\frac{{{b}}}{{{d2}}} = ?$$"
        hint = f"Bring beide Brüche auf den Hauptnenner {den // gcd(d1, d2)}."
        return {"question": question, "accept": _frac_accepts(num, den), "hint": hint, "solution": answer}
    a, d1 = rng.randint(1, 4), rng.randint(2, 5)
    b, d2 = rng.randint(1, 4), rng.randint(2, 5)
    answer = _frac(a * b, d1 * d2)
    question = f"Multipliziere (vollständig gekürzt): $$\\frac{{{a}}}{{{d1}}} \\cdot \\frac{{{b}}}{{{d2}}} = ?$$"
    hint = "Zähler mal Zähler, Nenner mal Nenner — dann kürzen."
    return {"question": question, "accept": _frac_accepts(a * b, d1 * d2), "hint": hint, "solution": answer}


# ---------------------------------------------------------------------------
# mathe Kl. 7: Prozentrechnung
# ---------------------------------------------------------------------------

def _gen_prozent(difficulty: int, rng: random.Random) -> dict:
    """1: einfache Sätze (Geld/Punkte) · 2: Prozentwert (Geld/Umfrage) ·
    3: Prozentsatz · 4: Grundwert · 5: vermehrter/verminderter Grundwert
    (Rabatt/Zinsen)."""
    if difficulty <= 1:
        def _money(rng):
            p = rng.choice([10, 25, 50])
            g = rng.choice([40, 80, 120, 200, 400])
            ans = g * p // 100
            question = f"Wie viel sind $${p}\\,\\% \\text{{ von }} {g}\\ €?$$"
            hint = {10: "10 % = ein Zehntel.", 25: "25 % = ein Viertel.", 50: "50 % = die Hälfte."}[p]
            return question, ans, hint

        def _points(rng):
            p = rng.choice([10, 25, 50])
            g = rng.choice([20, 40, 60, 80])
            ans = g * p // 100
            question = f"Eine Klassenarbeit hat $${g}$$ Punkte. Wie viele Punkte sind $${p}\\,\\%$$ davon?"
            hint = {10: "10 % = ein Zehntel.", 25: "25 % = ein Viertel.", 50: "50 % = die Hälfte."}[p]
            return question, ans, hint

        question, ans, hint = rng.choice([_money, _points])(rng)
    elif difficulty == 2:
        def _money(rng):
            p = rng.choice([5, 15, 20, 30, 40, 60, 75])
            g = rng.choice([200, 300, 400, 500, 800])
            ans = g * p // 100
            question = f"Berechne den Prozentwert: $${p}\\,\\% \\text{{ von }} {g}\\ €$$"
            return question, ans, f"Prozentwert = Grundwert · Prozentsatz : 100, also {g} · {p} : 100."

        def _survey(rng):
            p = rng.choice([5, 15, 20, 30, 40, 60, 75])
            g = rng.choice([40, 80, 120, 160, 200])
            ans = g * p // 100
            question = (f"Bei einer Umfrage unter $${g}$$ Schülern stimmten $${p}\\,\\%$$ zu. "
                        "Wie viele Schüler waren das?")
            return question, ans, f"Prozentwert = Grundwert · Prozentsatz : 100, also {g} · {p} : 100."

        question, ans, hint = rng.choice([_money, _survey])(rng)
    elif difficulty == 3:
        g = rng.choice([200, 250, 400, 500])
        p = rng.choice([10, 20, 25, 30, 40, 50, 60])
        w = g * p // 100
        ans = p
        question = f"Wie viel Prozent sind $${w}\\ € \\text{{ von }} {g}\\ €?$$ (Zahl ohne %-Zeichen)"
        hint = f"Prozentsatz = Prozentwert : Grundwert · 100, also {w} : {g} · 100."
    elif difficulty == 4:
        p = rng.choice([10, 20, 25, 40, 50])
        ans = rng.choice([120, 200, 240, 300, 400])
        w = ans * p // 100
        question = (f"$${w}\\ €$$ sind $${p}\\,\\%$$ eines Betrags. Wie groß ist der ganze Betrag (Grundwert) in €?")
        hint = f"Grundwert = Prozentwert : Prozentsatz · 100, also {w} : {p} · 100."
    else:
        def _discount_or_markup(rng):
            base = rng.choice([120, 200, 240, 300, 400])
            p = rng.choice([10, 20, 25, 50])
            if rng.random() < 0.5:
                ans = base - base * p // 100
                question = f"Eine Jacke kostet $${base}\\ €$$ und ist um $${p}\\,\\%$$ reduziert. Was kostet sie jetzt (in €)?"
                hint = f"Erst den Rabatt berechnen ({p} % von {base} €), dann abziehen."
            else:
                ans = base + base * p // 100
                question = f"Ein Preis von $${base}\\ €$$ steigt um $${p}\\,\\%$$ Wie hoch ist der neue Preis (in €)?"
                hint = f"Erst den Aufschlag berechnen ({p} % von {base} €), dann dazurechnen."
            return question, ans, hint

        def _savings_interest(rng):
            base = rng.choice([50, 100, 150, 200])
            p = rng.choice([5, 10, 20])
            ans = base + base * p // 100
            question = (f"Auf einem Sparkonto liegen $${base}\\ €$$ Nach einem Jahr kommen "
                        f"$${p}\\,\\%$$ Zinsen dazu. Wie viel Geld ist jetzt auf dem Konto (in €)?")
            hint = f"Erst die Zinsen berechnen ({p} % von {base} €), dann dazurechnen."
            return question, ans, hint

        question, ans, hint = rng.choice([_discount_or_markup, _savings_interest])(rng)
    answer = str(ans)
    return {
        "question": question, "accept": [answer], "hint": hint, "solution": answer,
        "distractors": _distinct(rng, [ans + 10, ans - 10, ans * 2, ans // 2 if ans % 2 == 0 else ans + 5], answer),
    }


# ---------------------------------------------------------------------------
# mathe Kl. 6-7: Zuordnungen / Dreisatz
# ---------------------------------------------------------------------------

def _gen_zuordnungen(difficulty: int, rng: random.Random) -> dict:
    """1-2: proportional · 3: antiproportional · 4: Preis pro Einheit ·
    5: proportional mit größeren Zahlen."""
    if difficulty <= 1:
        objects = [("Hefte", "Heft"), ("Stifte", "Stift"), ("Wasserflaschen", "Wasserflasche")]

        def _price_for_n2(rng):
            plural, singular = rng.choice(objects)
            unit_price = rng.randint(2, 5)
            n1, n2 = rng.randint(2, 4), rng.randint(5, 9)
            cost1 = n1 * unit_price
            ans = n2 * unit_price
            question = f"${n1}$ {plural} kosten $${cost1}\\ €$$ Wie viel kosten ${n2}$ {plural}?"
            return question, ans, f"Rechne zuerst den Preis für 1 {singular} aus: {cost1} € : {n1}."

        def _unit_price(rng):
            plural, singular = rng.choice(objects)
            unit_price = rng.randint(2, 5)
            n1 = rng.randint(2, 6)
            cost1 = n1 * unit_price
            question = f"${n1}$ {plural} kosten zusammen $${cost1}\\ €$$ Wie viel kostet 1 {singular} (in €)?"
            return question, unit_price, f"Teile den Gesamtpreis durch die Anzahl: {cost1} € : {n1}."

        question, ans, hint = rng.choice([_price_for_n2, _unit_price])(rng)
    elif difficulty == 2:
        per = rng.randint(3, 8)
        n1 = rng.randint(3, 6)
        n2 = n1 * rng.randint(2, 3)
        ans = n2 * per
        question = (f"Eine Maschine schafft in ${n1}$ Minuten ${n1 * per}$ Teile. "
                     f"Wie viele Teile schafft sie in ${n2}$ Minuten?")
        hint = "Je mehr Zeit, desto mehr Teile — proportionale Zuordnung. Erst auf 1 Minute runterrechnen."
    elif difficulty == 3:
        total = rng.choice([12, 24, 36, 48])
        n1 = rng.choice([d for d in (2, 3, 4, 6) if total % d == 0])
        h1 = total // n1
        n2 = rng.choice([d for d in (2, 3, 4, 6, 8) if total % d == 0 and d != n1])
        ans = total // n2
        question = (f"${n1}$ Pumpen leeren ein Becken in ${h1}$ Stunden. "
                     f"Wie lange brauchen ${n2}$ Pumpen (in Stunden)?")
        hint = "Je mehr Pumpen, desto weniger Zeit — antiproportional. Das Produkt Pumpen · Stunden bleibt gleich."
    elif difficulty == 4:
        per_kg = rng.choice([1.5, 2.5, 3.5, 4.0, 2.0])
        kg1 = rng.randint(2, 4)
        kg2 = rng.randint(5, 8)
        ans = per_kg * kg2
        question = (f"${kg1}\\ \\text{{kg}}$ Äpfel kosten $${_fmt_num(per_kg * kg1)}\\ €$$ "
                     f"Wie viel kosten ${kg2}\\ \\text{{kg}}$ (in €)?")
        hint = "Erst den Preis pro Kilogramm ausrechnen."
    else:
        per100 = rng.choice([6, 7, 8, 9])
        km = rng.choice([250, 300, 350, 400, 450])
        ans = per100 * km // 100
        question = (f"Ein Auto verbraucht $${per100}\\ \\text{{l}}$$ auf $100$ km. "
                     f"Wie viel Liter verbraucht es auf ${km}$ km?")
        hint = f"Wie oft passen 100 km in {km} km?"
    answer = _fmt_num(ans) if isinstance(ans, float) else str(ans)
    return {"question": question, "accept": [answer], "hint": hint, "solution": answer}


# ---------------------------------------------------------------------------
# mathe Kl. 7: lineare Gleichungen (bestehend)
# ---------------------------------------------------------------------------

def _gen_linear_equation(difficulty: int, rng: random.Random) -> dict:
    """Linear equations with guaranteed integer solutions.
    1: x+b=c · 2: ax=c · 3: ax+b=c · 4: ax+b=cx+d · 5: a(x+b)=cx+d"""
    x = rng.randint(2, 9)
    if difficulty <= 1:
        b = rng.randint(1, 9)
        question = f"Löse nach $x$ auf: $$x + {b} = {x + b}$$"
        hint = f"Subtrahiere ${b}$ auf beiden Seiten."
    elif difficulty == 2:
        a = rng.randint(2, 9)
        question = f"Löse nach $x$ auf: $${a}x = {a * x}$$"
        hint = f"Teile beide Seiten durch ${a}$."
    elif difficulty == 3:
        a = rng.randint(2, 9)
        b = rng.randint(1, 12)
        question = f"Löse nach $x$ auf: $${a}x + {b} = {a * x + b}$$"
        hint = f"Erst ${b}$ auf beiden Seiten subtrahieren, dann durch ${a}$ teilen."
    elif difficulty == 4:
        c = rng.randint(1, 4)
        a = c + rng.randint(1, 4)  # a > c so the x terms collect positively
        b = rng.randint(1, 9)
        # a*x + b = c*x + d  =>  d = b + (a - c) * x, always positive
        d = b + (a - c) * x
        question = f"Löse nach $x$ auf: $${a}x + {b} = {c}x + {d}$$"
        hint = f"Bringe die $x$-Terme auf eine Seite: subtrahiere ${c}x$ auf beiden Seiten."
    else:
        c = rng.randint(1, 3)
        a = c + rng.randint(1, 3)  # a > c
        b = rng.randint(1, 5)
        # a*(x + b) = c*x + d  =>  d = a*x + a*b - c*x
        d = a * x + a * b - c * x
        question = f"Löse nach $x$ auf: $${a}(x + {b}) = {c}x + {d}$$"
        hint = f"Löse zuerst die Klammer auf: ${a}(x+{b}) = {a}x + {a * b}$."
    return {"question": question, "accept": [str(x)], "hint": hint, "solution": str(x)}


# ---------------------------------------------------------------------------
# mathe Kl. 7: lineare Funktionen
# ---------------------------------------------------------------------------

def _gen_lineare_funktionen(difficulty: int, rng: random.Random) -> dict:
    """1: f(x)=mx auswerten · 2: f(x)=mx+n auswerten · 3: Nullstelle ·
    4: Steigung aus zwei Punkten · 5: n aus Punkt und Steigung."""
    if difficulty <= 1:
        m, a = rng.randint(2, 6), rng.randint(2, 8)
        ans = m * a
        question = f"Gegeben ist $$f(x) = {m}x$$ Berechne $f({a})$."
        hint = f"Setze $x = {a}$ ein."
    elif difficulty == 2:
        m, n, a = rng.randint(2, 5), rng.randint(1, 9), rng.randint(2, 7)
        ans = m * a + n
        question = f"Gegeben ist $$f(x) = {m}x + {n}$$ Berechne $f({a})$."
        hint = f"Setze $x = {a}$ ein: erst mal {m}, dann plus {n}."
    elif difficulty == 3:
        m = rng.randint(2, 5)
        x0 = rng.randint(2, 6)
        n = m * x0
        ans = x0
        question = f"Bestimme die Nullstelle von $$f(x) = {m}x - {n}$$"
        hint = f"Setze $f(x) = 0$ und löse: ${m}x - {n} = 0$."
    elif difficulty == 4:
        m = rng.randint(2, 5)
        x1 = rng.randint(0, 3)
        x2 = x1 + rng.randint(1, 4)
        n = rng.randint(0, 5)
        y1, y2 = m * x1 + n, m * x2 + n
        ans = m
        question = (f"Eine Gerade geht durch die Punkte $$P({x1}\\,|\\,{y1}) \\text{{ und }} Q({x2}\\,|\\,{y2})$$ "
                     "Wie groß ist die Steigung $m$?")
        hint = "Steigung = Höhenunterschied geteilt durch Längenunterschied: $(y_2 - y_1) : (x_2 - x_1)$."
    else:
        m = rng.randint(2, 5)
        x0, n = rng.randint(1, 5), rng.randint(1, 9)
        y0 = m * x0 + n
        ans = n
        question = (f"Eine Gerade hat die Steigung $m = {m}$ und geht durch $$P({x0}\\,|\\,{y0})$$ "
                     "Bestimme den $y$-Achsenabschnitt $n$ (aus $y = mx + n$).")
        hint = f"Setze den Punkt ein: ${y0} = {m} \\cdot {x0} + n$ und löse nach $n$."
    answer = str(ans)
    return {
        "question": question, "accept": [answer], "hint": hint, "solution": answer,
        "distractors": _distinct(rng, [ans + 1, ans - 1, ans + 2], answer),
    }


# ---------------------------------------------------------------------------
# mathe Kl. 4-7: Geometrie (mit SVG-Skizzen)
# ---------------------------------------------------------------------------

def _gen_geometrie(difficulty: int, rng: random.Random) -> dict:
    """1: Umfang Rechteck/Quadrat (auch rückwärts) · 2: Fläche Rechteck (auch
    rückwärts) · 3: Fläche Dreieck · 4: Winkelsumme Dreieck · 5: Volumen
    Quader (auch rückwärts). Jede Aufgabe mit Skizze."""
    if difficulty <= 1:
        def _umfang_rechteck(rng):
            a, b = rng.randint(4, 12), rng.randint(2, 8)
            ans = 2 * (a + b)
            svg = svg_rectangle(a, b)
            return "Berechne den Umfang des Rechtecks (in cm).", ans, \
                "Umfang = 2 · (Länge + Breite).", svg, [a * b, a + b, 2 * a + b]

        def _umfang_quadrat(rng):
            s = rng.randint(3, 12)
            ans = 4 * s
            svg = svg_rectangle(s, s)
            return "Berechne den Umfang des Quadrats (in cm).", ans, \
                "Umfang = 4 · Seitenlänge.", svg, [s * s, 2 * s, 3 * s]

        def _umfang_rechteck_reverse(rng):
            a, b = rng.randint(4, 12), rng.randint(2, 8)
            u = 2 * (a + b)
            question = (f"Der Umfang eines Rechtecks beträgt $${u}\\ \\text{{cm}}$$ Eine Seite ist "
                        f"$${a}\\ \\text{{cm}}$$ lang. Wie lang ist die andere Seite (in cm)?")
            svg = svg_rectangle(a, b, label_b="?")
            return question, b, f"Halber Umfang minus die bekannte Seite: {u} : 2 − {a}.", \
                svg, [u - a, u // 2, a]

        question, ans, hint, svg, distractors = rng.choice(
            [_umfang_rechteck, _umfang_quadrat, _umfang_rechteck_reverse]
        )(rng)
    elif difficulty == 2:
        def _flaeche_rechteck(rng):
            a, b = rng.randint(4, 12), rng.randint(3, 9)
            ans = a * b
            svg = svg_rectangle(a, b)
            return "Berechne den Flächeninhalt des Rechtecks (in cm²).", ans, \
                "Fläche = Länge · Breite.", svg, [2 * (a + b), a + b, a * b * 2]

        def _flaeche_rechteck_reverse(rng):
            a, b = rng.randint(4, 12), rng.randint(3, 9)
            area = a * b
            question = (f"Ein Rechteck hat den Flächeninhalt $${area}\\ \\text{{cm}}^2$$ Eine Seite "
                        f"ist $${a}\\ \\text{{cm}}$$ lang. Wie lang ist die andere Seite (in cm)?")
            svg = svg_rectangle(a, b, label_b="?")
            return question, b, f"Fläche durch die bekannte Seite teilen: {area} : {a}.", \
                svg, [area - a, area // 2, a]

        question, ans, hint, svg, distractors = rng.choice(
            [_flaeche_rechteck, _flaeche_rechteck_reverse]
        )(rng)
    elif difficulty == 3:
        g = rng.choice([4, 6, 8, 10, 12])
        h = rng.randint(3, 9)
        ans = g * h // 2
        question = "Berechne den Flächeninhalt des Dreiecks (in cm²)."
        hint = "Dreiecksfläche = (Grundseite · Höhe) : 2."
        svg = svg_triangle_base_height(g, h)
        distractors = [g * h, g + h, (g + h) // 2]
    elif difficulty == 4:
        alpha = rng.randint(30, 80)
        beta = rng.randint(30, 80)
        ans = 180 - alpha - beta
        question = "Wie groß ist der Winkel $\\gamma$ (in Grad)?"
        hint = "Die Winkelsumme im Dreieck beträgt 180°."
        svg = svg_triangle_angles(alpha, beta)
        distractors = [180 - alpha, 180 - beta, 360 - alpha - beta]
    else:
        def _volumen_quader(rng):
            a, b, c = rng.randint(3, 8), rng.randint(2, 6), rng.randint(2, 6)
            ans = a * b * c
            svg = svg_cuboid(a, b, c)
            return "Berechne das Volumen des Quaders (in cm³).", ans, \
                "Volumen = Länge · Breite · Höhe.", svg, \
                [a * b + c, a + b + c, 2 * (a * b + a * c + b * c)]

        def _volumen_quader_reverse(rng):
            a, b, c = rng.randint(3, 8), rng.randint(2, 6), rng.randint(2, 6)
            v = a * b * c
            question = (f"Das Volumen eines Quaders beträgt $${v}\\ \\text{{cm}}^3$$ Die Grundfläche "
                        f"hat die Maße $${a}\\ \\text{{cm}}$$ und $${b}\\ \\text{{cm}}$$ "
                        "Wie hoch ist der Quader (in cm)?")
            svg = svg_cuboid(a, b, c, label_c="?")
            return question, c, f"Volumen durch die Grundfläche teilen: {v} : ({a} · {b}).", \
                svg, [v // a, v // b, a + b + c]

        question, ans, hint, svg, distractors = rng.choice(
            [_volumen_quader, _volumen_quader_reverse]
        )(rng)
    answer = str(ans)
    return {
        "question": question, "accept": [answer], "hint": hint, "solution": answer,
        "image_svg": svg, "distractors": _distinct(rng, distractors, answer),
    }


# ---------------------------------------------------------------------------
# mathe Kl. 6-7: Stochastik (mit SVG, Brüche als Antworten)
# ---------------------------------------------------------------------------

def _gen_stochastik(difficulty: int, rng: random.Random) -> dict:
    """1: Würfel-/Glücksrad-Wahrscheinlichkeit · 2: Urne P(rot) · 3: Würfel-/
    Urnen-Ereignis · 4: Mittelwert (abstrakt/kontextuell) · 5: Zählprinzip
    (auch rückwärts)."""
    if difficulty <= 1:
        def _die_value(rng):
            v = rng.randint(1, 6)
            question = (f"Du würfelst einmal mit einem normalen Würfel. "
                        f"Wie groß ist die Wahrscheinlichkeit, eine ${v}$ zu würfeln? (als Bruch, z.B. 1/6)")
            return question, _frac_accepts(1, 6), "Ein Würfel hat 6 gleich wahrscheinliche Seiten.", \
                "1/6", svg_die(v)

        def _spinner_color(rng):
            n = rng.choice([4, 6, 8])
            k = rng.randint(1, n - 1)
            target, other = rng.sample(
                [("rot", "#ef4444"), ("blau", "#3b82f6"), ("gelb", "#eab308"), ("grün", "#22c55e")], 2
            )
            segments = [target[1]] * k + [other[1]] * (n - k)
            question = (f"Ein Glücksrad hat ${n}$ gleich große Felder, ${k}$ davon sind {target[0]}. "
                        f"Du drehst einmal. Wie groß ist die Wahrscheinlichkeit, dass der Zeiger auf "
                        f"{target[0]} zeigt? (vollständig gekürzter Bruch)")
            return question, _frac_accepts(k, n), f"Günstige Felder: {k}. Alle Felder: {n}.", \
                _frac(k, n), svg_spinner(segments)

        question, accept, hint, solution, svg = rng.choice([_die_value, _spinner_color])(rng)
        return {"question": question, "accept": accept, "hint": hint,
                "solution": solution, "image_svg": svg}
    if difficulty == 2:
        red = rng.randint(2, 6)
        blue = rng.randint(2, 6)
        container = rng.choice(["Urne", "Kiste", "Schublade"])
        question = (f"In der {container} liegen ${red}$ rote und ${blue}$ blaue Kugeln. "
                     "Du ziehst eine Kugel, ohne hinzusehen. Wie groß ist $P(\\text{rot})$? "
                     "(vollständig gekürzter Bruch)")
        hint = f"Günstige Kugeln: {red} rote. Alle Kugeln: {red + blue}."
        return {"question": question, "accept": _frac_accepts(red, red + blue), "hint": hint,
                "solution": _frac(red, red + blue), "image_svg": svg_urn(red, blue)}
    if difficulty == 3:
        def _die_event(rng):
            event, favorable, name = rng.choice([
                ("eine gerade Zahl", 3, "gerade Zahlen: 2, 4, 6"),
                ("eine Zahl größer als 4", 2, "größer als 4: 5 und 6"),
                ("eine Zahl kleiner als 3", 2, "kleiner als 3: 1 und 2"),
                ("keine 6", 5, "alle außer der 6"),
            ])
            question = (f"Du würfelst einmal. Wie groß ist die Wahrscheinlichkeit, {event} zu würfeln? "
                        "(vollständig gekürzter Bruch)")
            return question, _frac_accepts(favorable, 6), f"Günstige Ergebnisse: {name}.", \
                _frac(favorable, 6), svg_die(rng.randint(1, 6))

        def _urn_not_red(rng):
            red = rng.randint(2, 6)
            blue = rng.randint(2, 6)
            question = (f"In der Urne liegen ${red}$ rote und ${blue}$ blaue Kugeln. Du ziehst eine "
                        "Kugel, ohne hinzusehen. Wie groß ist die Wahrscheinlichkeit, KEINE rote "
                        "Kugel zu ziehen? (vollständig gekürzter Bruch)")
            hint = f"Keine rote Kugel heißt blau. Günstige Kugeln: {blue}. Alle Kugeln: {red + blue}."
            return question, _frac_accepts(blue, red + blue), hint, \
                _frac(blue, red + blue), svg_urn(red, blue)

        question, accept, hint, solution, svg = rng.choice([_die_event, _urn_not_red])(rng)
        return {"question": question, "accept": accept, "hint": hint,
                "solution": solution, "image_svg": svg}
    if difficulty == 4:
        def _abstract_numbers(rng):
            mean = rng.randint(5, 15)
            offsets = [rng.randint(-3, 3) for _ in range(3)]
            values = [mean + offsets[0], mean + offsets[1], mean + offsets[2], mean - sum(offsets)]
            rng.shuffle(values)
            vals = ", ".join(str(v) for v in values)
            return f"Berechne den Mittelwert (Durchschnitt) der Zahlen: $${vals}$$", mean, \
                f"Alle Zahlen addieren und durch {len(values)} teilen.", values

        def _test_scores(rng):
            mean = rng.randint(8, 16)
            offsets = [rng.randint(-2, 2) for _ in range(3)]
            values = [mean + offsets[0], mean + offsets[1], mean + offsets[2], mean - sum(offsets)]
            rng.shuffle(values)
            vals = ", ".join(str(v) for v in values)
            question = (f"Ein Schüler erreichte in vier Tests folgende Punktzahlen: $${vals}$$ "
                        "Wie hoch ist sein Mittelwert (Durchschnitt)?")
            return question, mean, f"Alle Punktzahlen addieren und durch {len(values)} teilen.", values

        def _long_jumps(rng):
            mean = rng.randint(4, 7)
            offsets = [rng.randint(-1, 1) for _ in range(3)]
            values = [mean + offsets[0], mean + offsets[1], mean + offsets[2], mean - sum(offsets)]
            rng.shuffle(values)
            vals = ", ".join(f"{v} m" for v in values)
            question = (f"Bei einem Weitsprung-Wettbewerb wurden folgende Weiten gemessen: $${vals}$$ "
                        "Wie groß ist die durchschnittliche Weite (in m)?")
            return question, mean, f"Alle Weiten addieren und durch {len(values)} teilen.", values

        question, mean, hint, values = rng.choice([_abstract_numbers, _test_scores, _long_jumps])(rng)
        return {"question": question, "accept": [str(mean)], "hint": hint, "solution": str(mean),
                "distractors": _distinct(rng, [mean + 1, mean - 1, sum(values)], str(mean))}

    def _outfits(rng):
        hosen, shirts, jacken = rng.randint(2, 4), rng.randint(3, 5), rng.randint(2, 3)
        ans = hosen * shirts * jacken
        question = (f"Du hast ${hosen}$ Hosen, ${shirts}$ T-Shirts und ${jacken}$ Jacken. "
                    "Wie viele verschiedene Outfits (je 1 Hose, 1 T-Shirt, 1 Jacke) kannst du kombinieren?")
        hint = "Zählprinzip: Anzahl Hosen · Anzahl T-Shirts · Anzahl Jacken."
        return question, ans, hint, [hosen + shirts + jacken, hosen * shirts, ans * 2]

    def _icecream(rng):
        sorten, toppings = rng.randint(3, 6), rng.randint(2, 4)
        ans = sorten * toppings
        question = (f"Eine Eisdiele bietet ${sorten}$ Eissorten und ${toppings}$ Toppings an. "
                    "Wie viele verschiedene Eisbecher (1 Sorte + 1 Topping) kannst du zusammenstellen?")
        hint = "Zählprinzip: Anzahl Sorten · Anzahl Toppings."
        return question, ans, hint, [sorten + toppings, sorten, ans * 2]

    def _outfits_reverse(rng):
        hosen, shirts, jacken = rng.randint(2, 4), rng.randint(3, 5), rng.randint(2, 3)
        total = hosen * shirts * jacken
        question = (f"Du kannst aus deinen Hosen, T-Shirts und Jacken insgesamt ${total}$ "
                    "verschiedene Outfits (je 1 Hose, 1 T-Shirt, 1 Jacke) kombinieren. "
                    f"Du hast ${hosen}$ Hosen und ${shirts}$ T-Shirts. Wie viele Jacken hast du?")
        hint = f"Teile die Gesamtzahl durch Hosen mal T-Shirts: {total} : ({hosen} · {shirts})."
        return question, jacken, hint, [hosen, shirts, total]

    question, ans, hint, distractors = rng.choice([_outfits, _icecream, _outfits_reverse])(rng)
    return {"question": question, "accept": [str(ans)], "hint": hint, "solution": str(ans),
            "distractors": _distinct(rng, distractors, str(ans))}


# ---------------------------------------------------------------------------
# Zahlenstrahl (interactive board — the Übungsseite renders `board` as a
# draggable number line instead of a text input; the placed value is still
# submitted as a plain answer string and checked against `accept`)
# ---------------------------------------------------------------------------

def _gen_zahlenstrahl(difficulty: int, rng: random.Random) -> dict:
    """1: 0–10 ganze Zahlen · 2: 0–100 in 5er-Schritten · 3: negative Zahlen
    −50..50 · 4: Dezimalzahlen 0–10 in 0,5-Schritten · 5: Dezimalzahlen
    −2..2 in 0,25-Schritten. Snapping (axis.step) macht den exakten
    Antwortabgleich fair."""
    lo, hi, step = {
        1: (0, 10, 1),
        2: (0, 100, 5),
        3: (-50, 50, 5),
        4: (0, 10, 0.5),
        5: (-2, 2, 0.25),
    }[difficulty]

    # Target on the grid, excluding the labeled endpoints (too easy).
    n_steps = round((hi - lo) / step)
    value = round(lo + rng.randint(1, n_steps - 1) * step, 4)
    label = _fmt_num(value)

    return {
        "question": f"Markiere die Zahl ${label.replace(',', '{,}')}$ auf dem Zahlenstrahl.",
        "accept": [label],
        "hint": f"Der Strahl geht von {_fmt_num(lo)} bis {_fmt_num(hi)} — ein Schritt ist {_fmt_num(step)}.",
        "board": {
            "mode": "sort",
            "scoring": "position",
            "axis": {"kind": "number", "min": lo, "max": hi, "step": step},
            "items": [{"id": "zahl", "label": label}],
        },
    }


# ---------------------------------------------------------------------------
# registry
# ---------------------------------------------------------------------------

REGISTRY: dict[str, GeneratorDescriptor] = {
    d.id: d
    for d in [
        GeneratorDescriptor(
            id="grundrechenarten", label="Grundrechenarten", subject="mathe",
            description="Plus, Minus, Mal, Geteilt — vom Zahlenraum bis 20 bis Punkt-vor-Strich.",
            generate=_gen_grundrechenarten, grades=[1, 2, 3, 4],
        ),
        GeneratorDescriptor(
            id="zahlenstrahl", label="Zahlenstrahl", subject="mathe",
            description="Zahlen an der richtigen Stelle auf dem Zahlenstrahl markieren — bis hin zu negativen und Dezimalzahlen.",
            generate=_gen_zahlenstrahl, grades=[3, 4, 5, 6],
        ),
        GeneratorDescriptor(
            id="groessen", label="Größen umrechnen", subject="mathe",
            description="Längen, Massen, Zeit und Geld umrechnen (m/cm, kg/g, h/min, €/ct).",
            generate=_gen_groessen, grades=[3, 4, 5],
        ),
        GeneratorDescriptor(
            id="brueche", label="Brüche", subject="mathe",
            description="Bruch von Menge, kürzen, addieren und multiplizieren.",
            generate=_gen_brueche, grades=[6],
        ),
        GeneratorDescriptor(
            id="prozent", label="Prozentrechnung", subject="mathe",
            description="Prozentwert, Prozentsatz, Grundwert, Rabatt und Aufschlag.",
            generate=_gen_prozent, grades=[7],
        ),
        GeneratorDescriptor(
            id="zuordnungen", label="Zuordnungen & Dreisatz", subject="mathe",
            description="Proportionale und antiproportionale Zuordnungen mit Sachaufgaben.",
            generate=_gen_zuordnungen, grades=[6, 7],
        ),
        GeneratorDescriptor(
            id="linear_equation", label="Lineare Gleichungen", subject="mathe",
            description="Gleichungen nach x auflösen — von x+b=c bis Klammern und x auf beiden Seiten.",
            generate=_gen_linear_equation, grades=[7],
        ),
        GeneratorDescriptor(
            id="lineare_funktionen", label="Lineare Funktionen", subject="mathe",
            description="Funktionswerte, Nullstellen, Steigung aus zwei Punkten, y-Achsenabschnitt.",
            generate=_gen_lineare_funktionen, grades=[7],
        ),
        GeneratorDescriptor(
            id="geometrie", label="Geometrie", subject="mathe",
            description="Umfang, Flächen, Winkelsumme und Volumen — jede Aufgabe mit Skizze.",
            generate=_gen_geometrie, grades=[4, 5, 6, 7],
        ),
        GeneratorDescriptor(
            id="stochastik", label="Stochastik & Daten", subject="mathe",
            description="Wahrscheinlichkeiten (Würfel, Urne), Mittelwert und Zählprinzip — mit Bildern.",
            generate=_gen_stochastik, grades=[6, 7],
        ),
    ]
}


def generate_task(topic: str, difficulty: int, rng: random.Random) -> dict:
    gen = REGISTRY.get(topic)
    if not gen:
        raise KeyError(topic)
    difficulty = max(DIFFICULTY_MIN, min(DIFFICULTY_MAX, difficulty))
    return gen.generate(difficulty, rng)
