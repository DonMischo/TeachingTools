"""
Zeitstrahl engine — shared validation and scoring for everything that lives
on a continuous line (historische Zeitleisten, Zahlenstrahlen, Skalen).

Three consumers embed the same TimelineGameSpec JSON and call into here:
  - Caputh questions of type "timeline"      (api/routers/capuths.py)
  - Exitgame tasks of kind "timeline"        (api/routers/exitgame.py)
  - the standalone Zeitstrahl tool sets      (api/routers/timelines.py)

A spec is authored content and therefore validated with the same hand-rolled
error-list style as Caputh/Exitgame uploads (German messages, no jsonschema).

Game modes:
  sort — items are shown WITHOUT their value; the student places each one on
         the axis. Answer: {"placements": {item_id: number}}.
         scoring "position": an item is correct iff |placed - value| <= tolerance.
         scoring "order":    an item is correct iff its rank among the placed
                             values equals its rank among the true values
                             (for eras where the exact year is unfair to ask).
  spot — items are shown AT their (possibly wrong) displayed value; the student
         flags the misplaced ones. An item is misplaced iff it has an "actual"
         value that differs from the displayed "value".
         Answer: {"flagged": [item_id, ...]}.

Both scorers return a per-item result map plus a 0.0-1.0 ratio, so Caputh can
give partial credit while Exitgame keeps its binary correct/incorrect.
"""
import math
import re
from datetime import date

AXIS_KINDS = {"number", "year"}
GAME_MODES = {"sort", "spot"}
SCORING_MODES = {"position", "order"}

# Fraction of the axis span used as tolerance when the author sets neither
# `tolerance` nor a snap `step`.
DEFAULT_TOLERANCE_RATIO = 0.05


def _is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


_ISO_DATE_RE = re.compile(r"^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$")


def _parse_iso_date(iso: str) -> tuple[int, int | None, int | None] | None:
    """Mirror of the frontend's parseIsoDate (scale.ts). Accepts a CE ISO-8601
    date at any of the three precisions — 'YYYY', 'YYYY-MM', 'YYYY-MM-DD' —
    because that is what authors write when the day isn't known. None for
    anything else, including freeform labels like "21. April 753 v. Chr.
    (Überlieferung)", which stay display-only and are not range/consistency-
    checked below (deliberately CE-only, see scale.ts)."""
    m = _ISO_DATE_RE.match(iso.strip())
    if not m:
        return None
    year = int(m.group(1))
    month = int(m.group(2)) if m.group(2) else None
    day = int(m.group(3)) if m.group(3) else None
    if year < 1:
        return None
    if month is not None and not (1 <= month <= 12):
        return None
    if day is not None:
        try:
            date(year, month, day)  # rejects e.g. Feb 30
        except ValueError:
            return None
    return year, month, day


def _iso_date_to_year(iso: str) -> float | None:
    """A CE ISO-8601 date as a fractional year, e.g. "1942-01-20" -> ~1942.052.
    Reduced precisions anchor to the start of the month/year."""
    parsed = _parse_iso_date(iso)
    if parsed is None:
        return None
    year, month, day = parsed
    start = date(year, 1, 1)
    days_in_year = (date(year + 1, 1, 1) - start).days
    at = date(year, month or 1, day or 1)
    return year + (at - start).days / days_in_year


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_axis(axis, where: str = "axis") -> list[str]:
    errors: list[str] = []
    if not isinstance(axis, dict):
        return [f"{where}: fehlt oder ist kein Objekt"]
    kind = axis.get("kind")
    if kind not in AXIS_KINDS:
        errors.append(f"{where}.kind: '{kind}' ist ungültig (erlaubt: {', '.join(sorted(AXIS_KINDS))})")
    lo, hi = axis.get("min"), axis.get("max")
    if not _is_num(lo) or not _is_num(hi):
        errors.append(f"{where}: 'min' und 'max' müssen Zahlen sein")
    elif lo >= hi:
        errors.append(f"{where}: 'min' muss kleiner als 'max' sein")
    step = axis.get("step")
    if step is not None and (not _is_num(step) or step <= 0):
        errors.append(f"{where}.step: muss eine Zahl > 0 sein")
    unit = axis.get("unit")
    if unit is not None and not isinstance(unit, str):
        errors.append(f"{where}.unit: muss ein Text sein")
    return errors


def _validate_items(items, axis: dict, where: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(items, list) or not items:
        return [f"{where}.items: muss eine nicht-leere Liste sein"]
    lo, hi = axis.get("min"), axis.get("max")
    bounds_ok = _is_num(lo) and _is_num(hi)
    seen: set[str] = set()
    for i, item in enumerate(items):
        w = f"{where}.items[{i}]"
        if not isinstance(item, dict):
            errors.append(f"{w}: muss ein Objekt sein")
            continue
        iid = item.get("id")
        if not iid or not isinstance(iid, str):
            errors.append(f"{w}: 'id' (Text) fehlt")
        elif iid in seen:
            errors.append(f"{w}: doppelte id '{iid}'")
        else:
            seen.add(iid)
        if not item.get("label") or not isinstance(item.get("label"), str):
            errors.append(f"{w}: 'label' (Text) fehlt")
        for key in ("value", "actual"):
            v = item.get(key)
            if key == "value" and v is None:
                errors.append(f"{w}: 'value' (Zahl) fehlt")
            elif v is not None and not _is_num(v):
                errors.append(f"{w}.{key}: muss eine Zahl sein")
            elif v is not None and bounds_ok and not (lo <= v <= hi):
                errors.append(f"{w}.{key}: {v} liegt außerhalb der Achse [{lo}, {hi}]")
        # Day-precision for game items: without it, two events in the same
        # year land on the same spot and can be neither sorted nor scored.
        for key, ref_key in (("exact_date", "value"), ("exact_date_actual", "actual")):
            exact = item.get(key)
            if exact is None:
                continue
            if not isinstance(exact, str):
                errors.append(f"{w}.{key}: muss ein Text sein")
                continue
            parsed = _parse_iso_date(exact)
            if parsed is None:
                continue  # freeform label — display-only, same as for sets
            ref = item.get(ref_key)
            if _is_num(ref) and parsed[0] != ref:
                errors.append(f"{w}.{key}: {exact} (Jahr {parsed[0]}) passt nicht zu '{ref_key}' ({ref})")
    return errors


def validate_game_spec(spec, where: str = "timeline") -> list[str]:
    """Validate an embedded TimelineGameSpec (Caputh question / Exitgame task)."""
    if not isinstance(spec, dict):
        return [f"{where}: fehlt oder ist kein Objekt"]
    errors: list[str] = []
    mode = spec.get("mode")
    if mode not in GAME_MODES:
        errors.append(f"{where}.mode: '{mode}' ist ungültig (erlaubt: {', '.join(sorted(GAME_MODES))})")
    errors.extend(validate_axis(spec.get("axis"), f"{where}.axis"))
    errors.extend(_validate_items(spec.get("items"), spec.get("axis") or {}, where))

    tolerance = spec.get("tolerance")
    if tolerance is not None and (not _is_num(tolerance) or tolerance < 0):
        errors.append(f"{where}.tolerance: muss eine Zahl >= 0 sein (0 = exakt)")
    scoring = spec.get("scoring")
    if scoring is not None and scoring not in SCORING_MODES:
        errors.append(f"{where}.scoring: '{scoring}' ist ungültig (erlaubt: {', '.join(sorted(SCORING_MODES))})")

    if mode == "spot" and not errors:
        if not any(_item_is_misplaced(it) for it in spec["items"]):
            errors.append(f"{where}: mode 'spot' braucht mindestens ein falsch platziertes Item "
                          f"('actual' gesetzt und ungleich 'value')")
    return errors


def validate_set_payload(data) -> list[str]:
    """Validate a standalone TimelineSet payload (title/axis/lanes/events)."""
    if not isinstance(data, dict):
        return ["Payload muss ein JSON-Objekt sein"]
    errors: list[str] = []
    if not data.get("title") or not isinstance(data.get("title"), str):
        errors.append("Pflichtfeld fehlt: 'title'")
    errors.extend(validate_axis(data.get("axis")))
    axis = data.get("axis") or {}
    axis_lo, axis_hi = axis.get("min"), axis.get("max")
    axis_bounds_ok = _is_num(axis_lo) and _is_num(axis_hi)

    lanes = data.get("lanes", [])
    lane_ids: set[str] = set()
    if not isinstance(lanes, list):
        errors.append("'lanes' muss eine Liste sein")
        lanes = []
    for i, lane in enumerate(lanes):
        if not isinstance(lane, dict) or not lane.get("id") or not lane.get("label"):
            errors.append(f"lanes[{i}]: braucht 'id' und 'label'")
            continue
        if lane["id"] in lane_ids:
            errors.append(f"lanes[{i}]: doppelte id '{lane['id']}'")
        lane_ids.add(lane["id"])

    events = data.get("events", [])
    if not isinstance(events, list):
        errors.append("'events' muss eine Liste sein")
        events = []
    seen: set[str] = set()
    for i, ev in enumerate(events):
        w = f"events[{i}]"
        if not isinstance(ev, dict):
            errors.append(f"{w}: muss ein Objekt sein")
            continue
        eid = ev.get("id")
        if not eid or not isinstance(eid, str):
            errors.append(f"{w}: 'id' (Text) fehlt")
        elif eid in seen:
            errors.append(f"{w}: doppelte id '{eid}'")
        else:
            seen.add(eid)
        if not ev.get("label") or not isinstance(ev.get("label"), str):
            errors.append(f"{w}: 'label' (Text) fehlt")
        if not _is_num(ev.get("value")):
            errors.append(f"{w}: 'value' (Zahl) fehlt")
        end = ev.get("end")
        if end is not None:
            if not _is_num(end):
                errors.append(f"{w}.end: muss eine Zahl oder null sein")
            elif _is_num(ev.get("value")) and end < ev["value"]:
                errors.append(f"{w}.end: darf nicht vor 'value' liegen")
        lane = ev.get("lane")
        if lane is not None and lane not in lane_ids:
            errors.append(f"{w}.lane: unbekannte lane '{lane}'")
        cat = ev.get("category")
        if cat is not None and not isinstance(cat, str):
            errors.append(f"{w}.category: muss ein Text sein")
        for field in ("exact_date", "exact_date_end"):
            exact = ev.get(field)
            if exact is None:
                continue
            if not isinstance(exact, str):
                errors.append(f"{w}.{field}: muss ein Text sein")
                continue
            parsed = _parse_iso_date(exact)
            if parsed is None:
                continue  # not an ISO date — a freeform label, fine as-is
            cal_year = parsed[0]
            frac = _iso_date_to_year(exact)
            if axis_bounds_ok and not (axis_lo <= frac <= axis_hi):
                errors.append(f"{w}.{field}: {exact} liegt außerhalb der Achse [{axis_lo}, {axis_hi}]")
            ref = ev.get("value") if field == "exact_date" else end
            if _is_num(ref) and cal_year != ref:
                errors.append(
                    f"{w}.{field}: {exact} (Jahr {cal_year}) passt nicht zu "
                    f"'{'value' if field == 'exact_date' else 'end'}' ({ref})"
                )
    return errors


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _effective(item: dict, num_key: str, date_key: str) -> float | None:
    """An item's real position: the parsed exact date when it carries one,
    otherwise the plain year. Everything downstream (positioning, sorting,
    tolerance, misplacement) has to agree on this, or two events in the same
    year become indistinguishable."""
    exact = item.get(date_key)
    if isinstance(exact, str):
        parsed = _iso_date_to_year(exact)
        if parsed is not None:
            return parsed
    v = item.get(num_key)
    return float(v) if _is_num(v) else None


def effective_value(item: dict) -> float | None:
    return _effective(item, "value", "exact_date")


def effective_actual(item: dict) -> float | None:
    return _effective(item, "actual", "exact_date_actual")


def _item_is_misplaced(item: dict) -> bool:
    actual = effective_actual(item)
    return actual is not None and actual != effective_value(item)


def default_tolerance(spec: dict) -> float:
    if _is_num(spec.get("tolerance")):
        return float(spec["tolerance"])
    axis = spec.get("axis") or {}
    if _is_num(axis.get("step")):
        # Snapping means placements land on multiples of step — half a step
        # would make off-by-one-snap wrong, a full step keeps it forgiving.
        return float(axis["step"])
    return (float(axis["max"]) - float(axis["min"])) * DEFAULT_TOLERANCE_RATIO


# Position-mode tolerance — mirror of scale.ts positionCorrect.
# The tolerance is chosen explicitly by the author (a dropdown in the tool, a
# `tolerance` field in Caputh/Exitgame specs), in axis units (years):
#   tolerance > 0   -> correct iff |placed - effective| <= tolerance
#   tolerance == 0  -> exact: the year must match (and, on a short round where
#                      months can actually be placed, a month-precise date's
#                      month too)
#   tolerance omitted -> falls back to the snap step / 5% of span (number axes,
#                      legacy specs without an explicit tolerance)
SHORT_SPAN_YEARS = 25


def _is_month_round(axis: dict) -> bool:
    return axis.get("kind") == "year" and _is_num(axis.get("min")) and _is_num(axis.get("max")) \
        and (axis["max"] - axis["min"]) <= SHORT_SPAN_YEARS


def _month_index(v: float) -> int:
    return min(11, max(0, math.floor((v - math.floor(v)) * 12)))


def _item_has_month(item: dict) -> bool:
    exact = item.get("exact_date")
    if not isinstance(exact, str):
        return False
    parsed = _parse_iso_date(exact)
    return parsed is not None and parsed[1] is not None


def _axis_default_tolerance(axis: dict) -> float:
    """Tolerance when the author set neither `tolerance` nor a snap step: a full
    step if there is one, else 5% of the span — the pre-dropdown default, kept
    for number axes and legacy specs that carry no explicit tolerance."""
    step = axis.get("step")
    if _is_num(step) and step > 0:
        return float(step)
    return (float(axis["max"]) - float(axis["min"])) * DEFAULT_TOLERANCE_RATIO


def _position_correct(axis: dict, item: dict, placed, tolerance) -> bool:
    if not _is_num(placed):
        return False
    eff = effective_value(item)
    if eff is None:
        return False
    tol = float(tolerance) if _is_num(tolerance) else _axis_default_tolerance(axis)
    if tol > 0:
        return abs(placed - eff) <= tol + 1e-9
    # tol == 0 -> exact match, at the finest granularity the round can place.
    if axis.get("kind") == "year":
        value = item.get("value")
        if _is_month_round(axis) and _item_has_month(item):
            return math.floor(placed) == math.floor(eff) and _month_index(placed) == _month_index(eff)
        return _is_num(value) and math.floor(placed) == round(value)
    return abs(placed - eff) <= 1e-9


def _sort_results(spec: dict, placements: dict) -> dict[str, bool]:
    items = spec["items"]
    results: dict[str, bool] = {}
    if (spec.get("scoring") or "position") == "order":
        # Rank comparison: deterministic tie-break by item id.
        placed = [(it["id"], placements.get(it["id"])) for it in items]
        answered = [(iid, v) for iid, v in placed if _is_num(v)]
        placed_rank = {iid: r for r, (iid, _) in enumerate(sorted(answered, key=lambda p: (p[1], p[0])))}
        true_rank = {
            it["id"]: r
            for r, it in enumerate(sorted(items, key=lambda it: (effective_value(it), it["id"])))
        }
        for it in items:
            iid = it["id"]
            results[iid] = iid in placed_rank and placed_rank[iid] == true_rank[iid]
    else:
        axis = spec.get("axis") or {}
        tolerance = spec.get("tolerance")  # None -> default; 0 -> exact; >0 -> band
        for it in items:
            results[it["id"]] = _position_correct(axis, it, placements.get(it["id"]), tolerance)
    return results


def _spot_results(spec: dict, flagged) -> dict[str, bool]:
    flagged_set = {f for f in flagged if isinstance(f, str)} if isinstance(flagged, list) else set()
    return {
        it["id"]: (it["id"] in flagged_set) == _item_is_misplaced(it)
        for it in spec["items"]
    }


def score_answer(spec: dict, answer) -> tuple[float, dict[str, bool]]:
    """Return (ratio 0.0-1.0, per-item correctness). Malformed answers score 0."""
    if not isinstance(answer, dict):
        answer = {}
    if spec.get("mode") == "spot":
        results = _spot_results(spec, answer.get("flagged", []))
    else:
        placements = answer.get("placements")
        results = _sort_results(spec, placements if isinstance(placements, dict) else {})
    total = len(results)
    ratio = (sum(1 for ok in results.values() if ok) / total) if total else 0.0
    return ratio, results


def check_answer(spec: dict, answer) -> bool:
    """Binary correctness (Exitgame): every item right."""
    ratio, _ = score_answer(spec, answer)
    return ratio >= 1.0


# ---------------------------------------------------------------------------
# Client payloads
# ---------------------------------------------------------------------------

def sanitized_board(spec: dict) -> dict:
    """What the student may see BEFORE answering: sort mode strips the values
    (placing them is the task), spot mode shows displayed values but never
    which ones are misplaced.

    exact_date is part of the answer in sort mode and must be stripped with
    the value — leaving it in would hand over the solution. In spot mode it
    IS the displayed position, so it stays; exact_date_actual (the true spot
    of a misplaced item) never goes out before the reveal."""
    mode = spec.get("mode")
    items = []
    for it in spec.get("items", []):
        out = {"id": it["id"], "label": it["label"]}
        if mode == "spot":
            out["value"] = it["value"]
            if it.get("exact_date"):
                out["exact_date"] = it["exact_date"]
        items.append(out)
    return {
        "mode": mode,
        "axis": spec.get("axis") or {},
        "scoring": spec.get("scoring") or "position",
        "items": items,
    }


def solution_payload(spec: dict) -> dict:
    """What everyone may see AFTER the reveal: true values, misplaced flags,
    tolerance actually applied. `value_effective` is the real position the
    client should draw at (day-precise when the item carries an exact date),
    while `value`/`exact_date` stay as authored for labelling."""
    items = []
    for it in spec.get("items", []):
        out = {
            "id": it["id"],
            "label": it["label"],
            "value": it["value"],
            "misplaced": _item_is_misplaced(it),
        }
        eff = effective_value(it)
        if eff is not None:
            out["value_effective"] = eff
        if _is_num(it.get("actual")):
            out["actual"] = it["actual"]
        eff_actual = effective_actual(it)
        if eff_actual is not None:
            out["actual_effective"] = eff_actual
        for key in ("exact_date", "exact_date_actual"):
            if it.get(key):
                out[key] = it[key]
        if it.get("info"):
            out["info"] = it["info"]
        items.append(out)
    return {
        "mode": spec.get("mode"),
        "axis": spec.get("axis") or {},
        "scoring": spec.get("scoring") or "position",
        "tolerance": default_tolerance(spec) if spec.get("mode") == "sort" else None,
        "items": items,
    }
