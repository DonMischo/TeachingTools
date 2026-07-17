"""
Server-side fuzzy Dynamic Difficulty Adjustment (DDA) for Exitgame.

A faithful Python port of the client-side reference implementation in the
standalone Exitbuilder/Exitbuilder_text repos (frontend/game/dda/fuzzy.ts +
DdaEngine.ts) — ported to run server-side instead of in the browser, since
Exitgame results must be a trustworthy, teacher-auditable record and a
client-only engine can't be audited.

Pipeline (Mamdani-style fuzzy inference): fuzzification -> rule evaluation
(AND = min) -> aggregation (max of minima) -> centroid defuzzification.

The inference RULES (membership functions, rule base) are machinery and live
here in code as DEFAULT_RULESET. The differentiation CONTENT — hint budgets,
time limits, extra-example visibility, easier-task offers — is authored per
exit game inside the uploaded JSON's `dda.levels` (>= 3 levels, 5
recommended): an ordered ladder from "confident, minimal support" to
"struggling, maximum support". The fuzzy scaffolding_level output (0–100) is
partitioned equally across the levels to pick the active one. Power users may
instead embed a full `dda.ruleSet` / `dda.adaptationMatrix` to override both.
"""

RESOLUTION = 100
HISTORY_LIMIT = 50
RECENT_WINDOW = 10

# The subject-agnostic Mamdani rule base (ported verbatim from the reference
# implementation's generic rule-set document). Inputs are averaged over the
# recent event window; outputs 0-100 (time_limit 10-120s).
DEFAULT_RULESET = {
    "ruleSetId": "builtin-generic",
    "inputs": [
        {"id": "response_time", "range": [0, 60],
         "membershipFunctions": [
             {"name": "fast", "type": "triangular", "params": [0, 0, 15]},
             {"name": "medium", "type": "triangular", "params": [10, 30, 50]},
             {"name": "slow", "type": "triangular", "params": [40, 60, 60]},
         ]},
        {"id": "error_rate", "range": [0, 100],
         "membershipFunctions": [
             {"name": "low", "type": "triangular", "params": [0, 0, 30]},
             {"name": "medium", "type": "triangular", "params": [20, 50, 80]},
             {"name": "high", "type": "triangular", "params": [60, 100, 100]},
         ]},
        {"id": "help_requests", "range": [0, 10],
         "membershipFunctions": [
             {"name": "none", "type": "triangular", "params": [0, 0, 2]},
             {"name": "few", "type": "triangular", "params": [1, 3, 5]},
             {"name": "many", "type": "triangular", "params": [4, 10, 10]},
         ]},
        {"id": "retry_count", "range": [0, 5],
         "membershipFunctions": [
             {"name": "none", "type": "triangular", "params": [0, 0, 1]},
             {"name": "few", "type": "triangular", "params": [0, 2, 3]},
             {"name": "many", "type": "triangular", "params": [2, 5, 5]},
         ]},
    ],
    "outputs": [
        {"id": "difficulty_level", "range": [0, 100],
         "membershipFunctions": [
             {"name": "easy", "type": "triangular", "params": [0, 0, 25]},
             {"name": "normal", "type": "triangular", "params": [20, 50, 80]},
             {"name": "hard", "type": "triangular", "params": [60, 80, 100]},
             {"name": "very_hard", "type": "triangular", "params": [80, 100, 100]},
         ]},
        {"id": "npc_helpfulness", "range": [0, 100],
         "membershipFunctions": [
             {"name": "minimal", "type": "triangular", "params": [0, 0, 20]},
             {"name": "moderate", "type": "triangular", "params": [15, 50, 85]},
             {"name": "proactive", "type": "triangular", "params": [70, 100, 100]},
         ]},
        {"id": "time_limit", "range": [10, 120],
         "membershipFunctions": [
             {"name": "tight", "type": "triangular", "params": [10, 10, 30]},
             {"name": "comfortable", "type": "triangular", "params": [20, 60, 100]},
             {"name": "generous", "type": "triangular", "params": [80, 120, 120]},
         ]},
        {"id": "scaffolding_level", "range": [0, 100],
         "membershipFunctions": [
             {"name": "none", "type": "triangular", "params": [0, 0, 20]},
             {"name": "hints", "type": "triangular", "params": [10, 40, 70]},
             {"name": "guided", "type": "triangular", "params": [50, 80, 100]},
             {"name": "full", "type": "triangular", "params": [80, 100, 100]},
         ]},
    ],
    "rules": [
        {"id": "rule_001_confident",
         "antecedents": [{"input": "response_time", "fuzzySet": "fast"},
                          {"input": "error_rate", "fuzzySet": "low"}],
         "consequents": [{"output": "npc_helpfulness", "fuzzySet": "minimal"},
                          {"output": "time_limit", "fuzzySet": "tight"},
                          {"output": "scaffolding_level", "fuzzySet": "none"}],
         "weight": 1.0},
        {"id": "rule_002_struggling",
         "antecedents": [{"input": "response_time", "fuzzySet": "medium"},
                          {"input": "error_rate", "fuzzySet": "high"}],
         "consequents": [{"output": "npc_helpfulness", "fuzzySet": "proactive"},
                          {"output": "time_limit", "fuzzySet": "generous"},
                          {"output": "scaffolding_level", "fuzzySet": "guided"}],
         "weight": 1.0},
        {"id": "rule_003_lost",
         "antecedents": [{"input": "error_rate", "fuzzySet": "high"},
                          {"input": "help_requests", "fuzzySet": "many"}],
         "consequents": [{"output": "npc_helpfulness", "fuzzySet": "proactive"},
                          {"output": "time_limit", "fuzzySet": "generous"},
                          {"output": "scaffolding_level", "fuzzySet": "full"}],
         "weight": 1.0},
        {"id": "rule_004_independent_struggler",
         "antecedents": [{"input": "error_rate", "fuzzySet": "high"},
                          {"input": "help_requests", "fuzzySet": "few"}],
         "consequents": [{"output": "npc_helpfulness", "fuzzySet": "moderate"},
                          {"output": "time_limit", "fuzzySet": "comfortable"},
                          {"output": "scaffolding_level", "fuzzySet": "hints"}],
         "weight": 1.0},
        {"id": "rule_005_frustration_guard",
         "antecedents": [{"input": "retry_count", "fuzzySet": "many"},
                          {"input": "response_time", "fuzzySet": "slow"}],
         "consequents": [{"output": "npc_helpfulness", "fuzzySet": "proactive"},
                          {"output": "time_limit", "fuzzySet": "generous"},
                          {"output": "scaffolding_level", "fuzzySet": "full"}],
         "weight": 1.2},
        {"id": "rule_006_steady",
         "antecedents": [{"input": "response_time", "fuzzySet": "medium"},
                          {"input": "error_rate", "fuzzySet": "medium"}],
         "consequents": [{"output": "npc_helpfulness", "fuzzySet": "moderate"},
                          {"output": "time_limit", "fuzzySet": "comfortable"},
                          {"output": "scaffolding_level", "fuzzySet": "hints"}],
         "weight": 1.0},
        {"id": "rule_007_mastery",
         "antecedents": [{"input": "response_time", "fuzzySet": "fast"},
                          {"input": "error_rate", "fuzzySet": "low"},
                          {"input": "help_requests", "fuzzySet": "none"},
                          {"input": "retry_count", "fuzzySet": "none"}],
         "consequents": [{"output": "time_limit", "fuzzySet": "tight"}],
         "weight": 1.0},
    ],
}


def levels_to_matrix(levels: list[dict]) -> dict:
    """Convert an authored `dda.levels` ladder into an adaptationMatrix over
    scaffolding_level: N levels partition 0-100 into N equal ranges, level 0
    = confident/minimal support, last level = struggling/maximum support.
    Every non-range key of a level is passed through as a content param
    (hintCount, timeLimitSeconds, extraExample, offerEasier, name, ...)."""
    n = len(levels)
    ranges = []
    for i, level in enumerate(levels):
        ranges.append({
            "min": round(i * 100 / n, 4),
            "max": round((i + 1) * 100 / n, 4) if i < n - 1 else 100,
            **level,
        })
    return {"scaffolding_level": {"ranges": ranges}}


def _fuzzify(x: float, mf: dict) -> float:
    p = mf["params"]
    if mf["type"] == "triangular":
        a, b, c = p[0], p[1], p[2]
        if a == b and x <= b:
            return 1.0
        if b == c and x >= b:
            return 1.0
        if x <= a or x >= c:
            return 1.0 if x == b else 0.0
        if x == b:
            return 1.0
        if x < b:
            return (x - a) / (b - a)
        return (c - x) / (c - b)
    a, b, c, d = p[0], p[1], p[2], p[3]
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (d - x) / (d - c)


def infer(rule_set: dict, inputs: dict[str, float]) -> dict[str, float]:
    """Crisp inputs -> crisp outputs, following rule_set's inputs/outputs/rules."""
    inputs_by_id = {i["id"]: i for i in rule_set["inputs"]}
    fired: list[tuple[float, list[dict]]] = []

    for rule in rule_set["rules"]:
        strength = 1.0
        for ant in rule["antecedents"]:
            input_def = inputs_by_id.get(ant["input"])
            mf = None
            if input_def:
                mf = next((m for m in input_def["membershipFunctions"] if m["name"] == ant["fuzzySet"]), None)
            if not input_def or not mf or ant["input"] not in inputs:
                strength = 0.0
                break
            strength = min(strength, _fuzzify(inputs[ant["input"]], mf))
        if strength > 0:
            fired.append((strength * rule.get("weight", 1.0), rule["consequents"]))

    results: dict[str, float] = {}
    for output in rule_set["outputs"]:
        lo, hi = output["range"]
        step = (hi - lo) / RESOLUTION
        numerator = 0.0
        denominator = 0.0
        for i in range(RESOLUTION + 1):
            x = lo + i * step
            degree = 0.0
            for firing_strength, consequents in fired:
                for con in consequents:
                    if con["output"] != output["id"]:
                        continue
                    mf = next((m for m in output["membershipFunctions"] if m["name"] == con["fuzzySet"]), None)
                    if not mf:
                        continue
                    degree = max(degree, min(firing_strength, _fuzzify(x, mf)))
            numerator += x * degree
            denominator += degree
        results[output["id"]] = numerator / denominator if denominator > 0 else (lo + hi) / 2
    return results


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def current_metrics(history: list[dict]) -> dict[str, float]:
    """Average the last RECENT_WINDOW performance snapshots into fuzzy-rule
    input ids. Neutral priors before any data exists (mirrors DdaEngine.ts)."""
    recent = history[-RECENT_WINDOW:]
    if not recent:
        return {"response_time": 30, "error_rate": 50, "help_requests": 0, "retry_count": 0}
    return {
        "response_time": _avg([r["responseTime"] for r in recent]),
        "error_rate": _avg([r["errorRate"] for r in recent]),
        "help_requests": _avg([r["helpRequests"] for r in recent]),
        "retry_count": _avg([r["retryCount"] for r in recent]),
    }


def is_frustrated(history: list[dict]) -> bool:
    recent = history[-5:]
    if len(recent) < 3:
        return False
    return (
        _avg([r["retryCount"] for r in recent]) > 2
        and _avg([r["errorRate"] for r in recent]) > 60
        and _avg([r["engagementScore"] for r in recent]) < 40
    )


def is_bored(history: list[dict]) -> bool:
    recent = history[-5:]
    if len(recent) < 3:
        return False
    return (
        _avg([r["responseTime"] for r in recent]) < 10
        and _avg([r["errorRate"] for r in recent]) < 20
        and _avg([r["engagementScore"] for r in recent]) < 30
    )


def map_to_content(adaptation_matrix: dict, outputs: dict[str, float]) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for output_id, value in outputs.items():
        ranges = adaptation_matrix.get(output_id, {}).get("ranges")
        if not ranges:
            continue
        for r in ranges:
            if r["min"] <= value <= r["max"]:
                result[output_id] = {k: v for k, v in r.items() if k not in ("min", "max")}
                break
    return result


def engagement_score(success: bool, retries: int, hints_used: int, time_spent: float) -> float:
    """Mirrors DdaEngine.ts's `engagement()`."""
    score = 50.0
    if success:
        score += 20
    if retries > 0:
        score += 10  # persistence
    if 0 < hints_used < 3:
        score += 10  # strategic help use
    if time_spent < 5:
        score -= 20  # guessing
    return max(0.0, min(100.0, score))


def snapshot_from_task_metrics(success: bool, time_spent: float, errors: int, hints_used: int, retries: int) -> dict:
    """Mirrors DdaEngine.ts's `recordMinigame()` -> PerformanceSnapshot conversion."""
    attempts = errors + (1 if success else 0)
    return {
        "responseTime": time_spent,
        "errorRate": (errors / max(attempts, 1)) * 100,
        "helpRequests": hints_used,
        "retryCount": retries,
        "engagementScore": engagement_score(success, retries, hints_used, time_spent),
    }


def adapt(dda_cfg: dict, history: list[dict]) -> dict | None:
    """Entry point: the exit game's own `dda` config (from its uploaded JSON)
    plus the attempt's recent performance snapshots (oldest first, capped by
    the caller at HISTORY_LIMIT) -> AdaptationResult dict {outputs,
    contentParams, frustrated, bored}, or None if disabled/unconfigured.

    The differentiation ladder comes from dda_cfg["levels"] (authored per
    game); dda_cfg may instead embed a full ruleSet/adaptationMatrix."""
    if not dda_cfg or not dda_cfg.get("enabled", False):
        return None
    rule_set = dda_cfg.get("ruleSet") or DEFAULT_RULESET
    if dda_cfg.get("adaptationMatrix"):
        matrix = dda_cfg["adaptationMatrix"]
    elif dda_cfg.get("levels"):
        matrix = levels_to_matrix(dda_cfg["levels"])
    else:
        return None

    outputs = infer(rule_set, current_metrics(history))

    frustrated = is_frustrated(history)
    bored = is_bored(history)
    if frustrated:
        outputs["difficulty_level"] = max(0.0, outputs.get("difficulty_level", 50) - 30)
        outputs["npc_helpfulness"] = min(100.0, outputs.get("npc_helpfulness", 50) + 30)
        outputs["scaffolding_level"] = min(100.0, outputs.get("scaffolding_level", 50) + 20)
    if bored:
        outputs["difficulty_level"] = min(100.0, outputs.get("difficulty_level", 50) + 20)
        outputs["time_limit"] = max(10.0, outputs.get("time_limit", 60) - 15)

    return {
        "outputs": outputs,
        "contentParams": map_to_content(matrix, outputs),
        "frustrated": frustrated,
        "bored": bored,
    }
