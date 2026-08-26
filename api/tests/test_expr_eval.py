"""The restricted evaluator behind admin-authored task generators.

Its whole point is that an admin — not a developer — writes `answer_expr`
strings that get evaluated server-side. So the security contract (only numbers,
declared variables and the arithmetic operators; never a call, attribute,
import or builtin) matters as much as the arithmetic.
"""
import pytest

from api.expr_eval import eval_expr, render_template

VARS = {"a": 3.0, "b": 4.0, "c": 10.0}


# ── arithmetic ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("expr,expected", [
    ("1 + 2", 3),
    ("7 - 9", -2),
    ("6 * 7", 42),
    ("9 / 2", 4.5),
    ("9 // 2", 4),
    ("9 % 4", 1),
    ("2 ** 8", 256),
    ("2 ** -2", 0.25),
    ("-5", -5),
    ("+5", 5),
    ("--5", 5),
    ("2 + 3 * 4", 14),            # precedence
    ("(2 + 3) * 4", 20),
    ("2 ** 3 ** 2", 512),         # right-associative
    ("1.5 * 2", 3.0),
])
def test_plain_arithmetic(expr, expected):
    assert eval_expr(expr, {}) == expected


@pytest.mark.parametrize("expr,expected", [
    ("a", 3.0),
    ("(c - b) / a", 2.0),
    ("a * b + c", 22.0),
    ("-a", -3.0),
    ("c ** 2 - a", 97.0),
])
def test_declared_variables_are_substituted(expr, expected):
    assert eval_expr(expr, VARS) == pytest.approx(expected)


@pytest.mark.parametrize("expr", ["1 / 0", "1 // 0", "1 % 0", "a / (b - 4)"])
def test_division_by_zero_is_a_value_error_not_a_crash(expr):
    with pytest.raises(ValueError, match="Division durch 0"):
        eval_expr(expr, {"a": 1.0, "b": 4.0})


def test_huge_exponents_are_refused():
    """Keeps an authoring typo from pinning the CPU on 2**10000000."""
    with pytest.raises(ValueError, match="Exponent zu groß"):
        eval_expr("2 ** 11", {})
    with pytest.raises(ValueError, match="Exponent zu groß"):
        eval_expr("2 ** -11", {})
    assert eval_expr("2 ** 10", {}) == 1024
    # The exponent is evaluated first, so a nested tower is caught too.
    with pytest.raises(ValueError, match="Exponent zu groß"):
        eval_expr("2 ** 10 ** 10", {})


# ── the security contract ────────────────────────────────────────────────────

@pytest.mark.parametrize("expr", [
    "__import__('os').system('rm -rf /')",
    "open('/etc/passwd').read()",
    "abs(-1)",
    "(1).__class__",
    "().__class__.__bases__",
    "[1, 2][0]",
    "{'a': 1}['a']",
    "[x for x in range(10)]",
    "lambda: 1",
    "a if a else b",
    "a and b",
    "a > b",
    "1 & 2",
    "1 << 2",
    "f'{a}'",
    "'text'",
    "True",
    "None",
    "...",
])
def test_everything_that_is_not_arithmetic_is_rejected(expr):
    with pytest.raises(ValueError):
        eval_expr(expr, VARS)


def test_undeclared_names_are_rejected():
    with pytest.raises(ValueError, match="Unbekannte Variable"):
        eval_expr("a + z", VARS)
    # Builtins are names too — none of them resolve.
    with pytest.raises(ValueError, match="Unbekannte Variable"):
        eval_expr("pow", VARS)


@pytest.mark.parametrize("expr", ["", "1 +", "(1", "a b", "def f(): pass"])
def test_syntax_errors_surface_as_value_errors(expr):
    with pytest.raises(ValueError, match="Ungültiger Ausdruck"):
        eval_expr(expr, VARS)


def test_a_variable_may_shadow_nothing_dangerous():
    """Variables are looked up in the supplied dict only, never in globals."""
    with pytest.raises(ValueError, match="Unbekannte Variable"):
        eval_expr("eval_expr", VARS)


# ── template rendering ───────────────────────────────────────────────────────

def test_double_braces_are_substituted_and_katex_survives():
    out = render_template(r"\frac{{{a}}}{{{b}}} und \frac{x}{y}", {"a": 3.0, "b": 4.0})
    assert out == r"\frac{3}{4} und \frac{x}{y}"


def test_integers_render_without_a_decimal_point():
    assert render_template("{{a}} + {{b}} = {{c}}", {"a": 2.0, "b": 3.0, "c": 5.0}) == "2 + 3 = 5"
    assert render_template("{{a}}", {"a": 2.5}) == "2.5"
    assert render_template("{{a}}", {"a": -0.0}) == "0"


def test_a_placeholder_may_appear_more_than_once():
    assert render_template("{{a}}·{{a}}", {"a": 7.0}) == "7·7"


def test_unknown_placeholders_are_refused():
    with pytest.raises(ValueError, match="Unbekannte Variable in Vorlage"):
        render_template("{{x}}", {"a": 1.0})


def test_text_without_placeholders_is_returned_unchanged():
    assert render_template("Wie viel ist 2 + 2?", {}) == "Wie viel ist 2 + 2?"
