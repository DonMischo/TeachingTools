"""
Restricted arithmetic expression evaluator for admin-authored task
generators (api/routers/generators.py).

Security contract: admin-authored generator definitions carry an
`answer_expr` string (e.g. "(c - b) / a") evaluated against that instance's
randomly drawn variable values. This is NEVER passed to eval()/exec() —
it's parsed into a Python AST and walked by hand, allowing only numeric
literals, the four arithmetic operators, unary minus, parentheses, and
lookups of the declared variable names. Any other node type (function
calls, attribute access, subscripts, comprehensions, names outside the
provided variable set, ...) raises ValueError. This is what makes it safe
for an admin (not a developer) to author without becoming an RCE vector.
"""
import ast

_ALLOWED_BINOPS = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Pow, ast.Mod)


def eval_expr(expr: str, variables: dict[str, float]) -> float:
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as e:
        raise ValueError(f"Ungültiger Ausdruck: {e}")
    return _eval_node(tree.body, variables)


def _eval_node(node: ast.AST, variables: dict[str, float]) -> float:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return node.value
        raise ValueError(f"Unerlaubter Literal-Typ: {node.value!r}")
    if isinstance(node, ast.Name):
        if node.id not in variables:
            raise ValueError(f"Unbekannte Variable: '{node.id}'")
        return variables[node.id]
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        val = _eval_node(node.operand, variables)
        return val if isinstance(node.op, ast.UAdd) else -val
    if isinstance(node, ast.BinOp) and isinstance(node.op, _ALLOWED_BINOPS):
        left = _eval_node(node.left, variables)
        right = _eval_node(node.right, variables)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            if right == 0:
                raise ValueError("Division durch 0")
            return left / right
        if isinstance(node.op, ast.FloorDiv):
            if right == 0:
                raise ValueError("Division durch 0")
            return left // right
        if isinstance(node.op, ast.Mod):
            if right == 0:
                raise ValueError("Division durch 0")
            return left % right
        if isinstance(node.op, ast.Pow):
            if abs(right) > 10:
                raise ValueError("Exponent zu groß")
            return left ** right
    raise ValueError(f"Nicht erlaubt im Ausdruck: {type(node).__name__}")


def render_template(template: str, variables: dict[str, float]) -> str:
    """Substitute {{var}} placeholders (double braces, distinct from single
    braces used by KaTeX e.g. \\frac{a}{b}) with variable values. Integers
    render without a decimal point."""
    import re

    def repl(m: "re.Match") -> str:
        name = m.group(1)
        if name not in variables:
            raise ValueError(f"Unbekannte Variable in Vorlage: '{name}'")
        v = variables[name]
        return str(int(v)) if float(v).is_integer() else str(v)

    return re.sub(r"\{\{(\w+)\}\}", repl, template)
