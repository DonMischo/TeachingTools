"""
Lückentext engine — shared validation, fuzzy answer matching and client
payloads for the cloze/fill-in-the-blank tool.

Content lives in LueckentextSet (JSON-blob pattern like BingoSet/TimelineSet):
a text template with {{gap_id}} placeholders and a list of gap definitions.
The library is open to every teacher; validation follows the same hand-rolled
error-list style as Zeitstrahl/Caputh/TaskCrawler (German messages, no
jsonschema).

Gap types:
  word_bank       — the answer is drawn from a shared word bank (own answers
                     of all word_bank gaps + distractors), shown shuffled.
  free_type       — the student types the answer freely; scored with
                     fuzzy_match to forgive minor typos/umlaut spelling.
  multiple_choice — the student picks from `choices` (2-4 options incl. the
                     correct answer).
"""

GAP_TYPES = {"word_bank", "free_type", "multiple_choice"}
DIFFICULTIES = {"easy", "medium", "hard"}

import random
import re

_PLACEHOLDER_RE = re.compile(r"\{\{([^{}]+)\}\}")

_UMLAUT_MAP = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})


def normalize_de(s: str) -> str:
    return s.strip().lower().translate(_UMLAUT_MAP)


def normalize_name(name: str) -> str:
    return normalize_de(name)


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[-1]


def fuzzy_match(given: str, answer: str) -> str:
    if not given:
        return "wrong"
    g = normalize_de(given)
    a = normalize_de(answer)
    if g == a:
        return "exact"
    dist = _levenshtein(g, a)
    if dist <= max(1, len(a) // 5):
        return "near"
    return "wrong"


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_set_payload(data) -> list[str]:
    """Validate a standalone LueckentextSet payload (title/text/gaps)."""
    if not isinstance(data, dict):
        return ["Payload muss ein JSON-Objekt sein"]
    errors: list[str] = []
    if not data.get("title") or not isinstance(data.get("title"), str):
        errors.append("Pflichtfeld fehlt: 'title'")
    text = data.get("text")
    if not text or not isinstance(text, str):
        errors.append("Pflichtfeld fehlt: 'text'")
        text = ""

    gaps = data.get("gaps")
    if not isinstance(gaps, list) or not gaps:
        errors.append("'gaps' muss eine nicht-leere Liste sein")
        gaps = []

    gap_ids: set[str] = set()
    for i, gap in enumerate(gaps):
        w = f"gaps[{i}]"
        if not isinstance(gap, dict):
            errors.append(f"{w}: muss ein Objekt sein")
            continue
        gid = gap.get("id")
        if not gid or not isinstance(gid, str):
            errors.append(f"{w}: 'id' (Text) fehlt")
        elif gid in gap_ids:
            errors.append(f"{w}: doppelte id '{gid}'")
        else:
            gap_ids.add(gid)
        if not gap.get("answer") or not isinstance(gap.get("answer"), str):
            errors.append(f"{w}: 'answer' (Text) fehlt")
        gtype = gap.get("type")
        if gtype not in GAP_TYPES:
            errors.append(f"{w}.type: '{gtype}' ist ungültig (erlaubt: {', '.join(sorted(GAP_TYPES))})")
        difficulty = gap.get("difficulty", "medium")
        if difficulty not in DIFFICULTIES:
            errors.append(f"{w}.difficulty: '{difficulty}' ist ungültig (erlaubt: {', '.join(sorted(DIFFICULTIES))})")
        if gtype == "multiple_choice":
            choices = gap.get("choices")
            if not isinstance(choices, list) or not (2 <= len(choices) <= 4) or \
                    not all(isinstance(c, str) for c in choices) or len(set(choices)) != len(choices):
                errors.append(f"{w}.choices: muss eine Liste aus 2-4 eindeutigen Texten sein")
            elif isinstance(gap.get("answer"), str) and gap["answer"] not in choices:
                errors.append(f"{w}.choices: muss die Antwort '{gap['answer']}' enthalten")

    placeholders = set(_PLACEHOLDER_RE.findall(text))
    for gid in gap_ids:
        if gid not in placeholders:
            errors.append(f"text: Platzhalter '{{{{{gid}}}}}' fehlt für gaps mit id '{gid}'")
    for ph in placeholders:
        if ph not in gap_ids:
            errors.append(f"text: Platzhalter '{{{{{ph}}}}}' verweist auf unbekannte gap-id")

    distractors = data.get("distractors")
    if distractors is not None and (not isinstance(distractors, list) or not all(isinstance(d, str) for d in distractors)):
        errors.append("'distractors' muss eine Liste aus Texten sein")

    return errors


# ---------------------------------------------------------------------------
# Client payloads
# ---------------------------------------------------------------------------

def sanitized_board(s) -> dict:
    """What the student may see BEFORE answering: never the correct answer,
    multiple_choice options shuffled without revealing which is correct."""
    gaps_out = []
    word_bank: list[str] = []
    for gap in s.gaps:
        out = {
            "id": gap["id"],
            "type": gap["type"],
            "difficulty": gap.get("difficulty", "medium"),
            "hint": gap.get("hint"),
        }
        if gap["type"] == "multiple_choice":
            choices = list(gap.get("choices") or [])
            random.shuffle(choices)
            out["choices"] = choices
        else:
            out["choices"] = None
        gaps_out.append(out)
        if gap["type"] == "word_bank":
            word_bank.append(gap["answer"])
    word_bank.extend(s.distractors or [])
    random.shuffle(word_bank)
    return {"text": s.text, "gaps": gaps_out, "word_bank": word_bank}


def solution_payload(s) -> dict:
    return {"text": s.text, "gaps": [{"id": gap["id"], "answer": gap["answer"]} for gap in s.gaps]}


# ---------------------------------------------------------------------------
# Gap-reveal scaffolding (driven by api/dda.py's fuzzy DDA engine)
# ---------------------------------------------------------------------------

from . import dda

_REVEAL_LADDERS = {
    "easy":   [{"reveal": False, "hint": False}, {"reveal": True, "hint": True}, {"reveal": True, "hint": True}],
    "medium": [{"reveal": False, "hint": False}, {"reveal": False, "hint": True}, {"reveal": True, "hint": True}],
    "hard":   [{"reveal": False, "hint": False}, {"reveal": False, "hint": False}, {"reveal": False, "hint": True}],
}


_ESCALATE = {"hard": "medium", "medium": "easy", "easy": "easy"}


def reveal_state(difficulty: str, seconds_since_progress: float, attempts: int, miss_count: int = 0) -> dict:
    """Drive gap-reveal/hint decisions off api/dda.py's Mamdani engine: elapsed time
    without progress and failed-attempt count feed the same fuzzy inference used for
    TaskCrawler's difficulty adjustment, mapped onto a 3-level reveal ladder per difficulty.

    dda.adapt() needs dda_cfg["levels"] (the authored ladder, converted internally by
    levels_to_matrix into ranges over the "scaffolding_level" fuzzy output) and a
    history of PerformanceSnapshot-shaped dicts (responseTime, errorRate, helpRequests,
    retryCount, engagementScore — see dda.current_metrics/is_frustrated/is_bored).
    map_to_content() then returns, per output id, the matching ladder entry itself
    (min/max stripped) — so contentParams["scaffolding_level"] IS one of our ladder
    dicts directly; no extra index translation is needed.
    """
    ladder = _REVEAL_LADDERS[_ESCALATE[difficulty] if miss_count >= 2 else difficulty]
    dda_cfg = {"enabled": True, "levels": ladder}
    snapshot = {
        "responseTime": min(60, seconds_since_progress),
        "errorRate": min(100, attempts * 25),
        "helpRequests": 0,
        "retryCount": attempts,
        "engagementScore": 50,
    }
    result = dda.adapt(dda_cfg, [snapshot])
    if result:
        entry = result["contentParams"].get("scaffolding_level")
        if entry is not None:
            return entry
    return ladder[0]
