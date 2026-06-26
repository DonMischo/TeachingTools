"""
Wettkämpfe: competition management (K.O. bracket and Round Robin).

Lifecycle:
  1. POST /api/wettkampf          → create (status=draft)
  2. POST /api/wettkampf/{id}/participants  → add participants
  3. PUT  /api/wettkampf/{id}/stages       → configure point stages (legacy)
     OR set rewarded_places on the wettkampf for the formula-based system
  4. POST /api/wettkampf/{id}/generate     → generate bracket / pairings (status→active)
  5. PUT  /api/wettkampf/{id}/matches/{mid}/result → record match result
  6. POST /api/wettkampf/{id}/finish       → award points to linked classes
"""
import math
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_teacher
from ..database import get_db
from ..models import (
    Class, Teacher, Transaction,
    Wettkampf, WettkampfStage, WettkampfTeilnehmer, WettkampfMatch,
)

router = APIRouter(tags=["wettkampf"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class StageIn(BaseModel):
    name: str
    order: int
    points: float


SCORING_PRESETS: dict[str, dict] = {
    "soccer":  {"win_points": 3, "draw_points": 1, "loss_points": 0},
    "classic": {"win_points": 2, "draw_points": 1, "loss_points": 0},
    "tennis":  {"win_points": 1, "draw_points": 0, "loss_points": 0},
    "custom":  {"win_points": 1, "draw_points": 0, "loss_points": 0},
}

VALID_RANKING_MODES = {
    "overall", "per_group", "both",
    "gender", "overall+gender",
    "per_group+gender", "per_group_merged", "per_group_merged+gender",
}


class WettkampfCreate(BaseModel):
    title: str
    description: str | None = None
    type: str  # "knockout" | "round_robin" | "pairing"
    max_points: float = 10
    trostpreis_points: float = 1
    rewarded_places: int | None = None
    scoring_system: str = "soccer"
    win_points: float | None = None
    draw_points: float | None = None
    loss_points: float | None = None
    ranking_mode: str = "overall"
    stages: list[StageIn] | None = None


class WettkampfUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    max_points: float | None = None
    trostpreis_points: float | None = None
    rewarded_places: int | None = None
    scoring_system: str | None = None
    win_points: float | None = None
    draw_points: float | None = None
    loss_points: float | None = None
    ranking_mode: str | None = None


class ParticipantIn(BaseModel):
    name: str
    class_id: int | None = None
    seed: int | None = None
    group: str | None = None
    gender: str | None = None  # "m" | "f" | None


class ParticipantUpdate(BaseModel):
    group: str | None = None
    gender: str | None = None


class ManualPointEntry(BaseModel):
    participant_id: int
    points: float


class FinishIn(BaseModel):
    manual_points: list[ManualPointEntry] | None = None


class MatchResultIn(BaseModel):
    winner_id: int | None = None
    is_draw: bool = False
    score_p1: str | None = None
    score_p2: str | None = None


class StagesUpdate(BaseModel):
    stages: list[StageIn]


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _ser_participant(p: WettkampfTeilnehmer) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "seed": p.seed,
        "group": p.group,
        "gender": p.gender,
        "class_id": p.class_id,
        "class_name": p.class_.display_name if p.class_ else None,
    }


def _ser_stage(s: WettkampfStage) -> dict:
    return {"id": s.id, "name": s.name, "order": s.order, "points": s.points}


def _ser_match(m: WettkampfMatch) -> dict:
    return {
        "id": m.id,
        "round_number": m.round_number,
        "match_number": m.match_number,
        "stage_id": m.stage_id,
        "stage_name": m.stage.name if m.stage else None,
        "p1": _ser_participant(m.p1) if m.p1 else None,
        "p2": _ser_participant(m.p2) if m.p2 else None,
        "winner_id": m.winner_id,
        "is_draw": m.is_draw,
        "score_p1": m.score_p1,
        "score_p2": m.score_p2,
    }


def _ser_wettkampf(w: Wettkampf, include_matches: bool = False) -> dict:
    d = {
        "id": w.id,
        "title": w.title,
        "description": w.description,
        "type": w.type,
        "status": w.status,
        "max_points": w.max_points,
        "trostpreis_points": w.trostpreis_points,
        "rewarded_places": w.rewarded_places,
        "scoring_system": w.scoring_system,
        "win_points": w.win_points,
        "draw_points": w.draw_points,
        "loss_points": w.loss_points,
        "ranking_mode": w.ranking_mode,
        "created_at": w.created_at.isoformat(),
        "stages": [_ser_stage(s) for s in w.stages],
        "participants": [_ser_participant(p) for p in w.participants],
    }
    if include_matches:
        d["matches"] = [_ser_match(m) for m in w.matches]
        if w.type in ("round_robin", "pairing"):
            d["stats"] = _match_stats(w)
    return d


# ---------------------------------------------------------------------------
# Points formula helpers
# ---------------------------------------------------------------------------

def _placement_points(n: int, max_pts: float, trost: float) -> list[float]:
    """
    Returns n point values for places 1..n.
    Formula: 1st=max, 2nd=60%, 3rd=20%, 4th=10%, 5th=5%, ...halving tail.
    Clamped so nothing falls below trost+1.
    """
    result: list[float] = []
    for i in range(1, n + 1):
        if i == 1:
            p = float(max_pts)
        elif i == 2:
            p = float(max(trost + 1, round(max_pts * 0.6)))
        else:
            p = float(max(trost + 1, round(max_pts * 0.2 * (0.5 ** (i - 3)))))
        result.append(p)
    return result


def _strip_stufe(group: str) -> str:
    """Strip trailing alpha chars to get the grade/Stufe key: '7a' → '7', '8b' → '8'."""
    return re.sub(r'[a-zA-ZäöüÄÖÜ]+$', '', group).strip()


_GENDER_RE = re.compile(r'\s*(♂|♀|männlich|weiblich|\bm\b|\bw\b|\bf\b)$', re.IGNORECASE)

def _base_name(name: str) -> str:
    """Strip gender suffix: 'Klasse 7a ♂' → 'Klasse 7a'."""
    return _GENDER_RE.sub('', name).strip()


def _compute_class_awards(w, individual_stats: dict, max_pts: float, trost: float) -> list[dict]:
    """
    Merge participants by base name (strip ♂/♀), sum their match stats,
    rank the merged classes, and compute Hauspunkte based on that ranking.
    Returns list of {name, stats, points} sorted by rank.
    Only returned when there are actual merges (some names differ only by gender suffix).
    """
    ZERO = {"w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "gd": 0, "pts": 0}
    groups: dict[str, dict] = {}
    for p in w.participants:
        key = _base_name(p.name)
        if key not in groups:
            groups[key] = {"name": key, **ZERO}
        s = individual_stats.get(p.id, ZERO)
        g = groups[key]
        for k in ("w", "d", "l", "gf", "ga", "gd", "pts"):
            g[k] += s.get(k, 0)

    # Only include merged view if at least one class has both genders
    has_merge = len(groups) < len(w.participants)
    if not has_merge:
        return []

    ranked = sorted(groups.values(),
                    key=lambda g: (-g["pts"], -g["gd"], -g["gf"], g["name"]))
    n = len(ranked)
    n_rewarded = max(1, n // 2)
    place_pts = _placement_points(n_rewarded, max_pts, trost)

    result = []
    for i, g in enumerate(ranked):
        rank = i + 1
        hp = int(round(place_pts[rank - 1])) if rank <= n_rewarded else int(round(trost))
        result.append({
            "name": g["name"],
            "rank": rank,
            "stats": {k: g[k] for k in ("w", "d", "l", "gf", "ga", "gd", "pts")},
            "points": hp,
        })
    return result


# ---------------------------------------------------------------------------
# Stage auto-generation helpers (legacy)
# ---------------------------------------------------------------------------

_KO_STAGE_NAMES = [
    "Zweiunddreißigstelfinale",
    "Sechzehntelfinale",
    "Achtelfinale",
    "Viertelfinale",
    "Halbfinale",
    "Finale",
    "Sieger",
]


def _ko_stage_names(n_participants: int) -> list[str]:
    if n_participants <= 1:
        return ["Sieger"]
    rounds = math.ceil(math.log2(max(n_participants, 2)))
    base_names = _KO_STAGE_NAMES[:-1]
    available = base_names[-(rounds):]
    return available + ["Sieger"]


def _suggest_points(n_stages: int, max_points: float, trostpreis: float) -> list[float]:
    if n_stages == 1:
        return [max_points]
    pts: list[float] = [trostpreis]
    remaining = max_points - trostpreis
    for i in range(1, n_stages):
        if i == n_stages - 1:
            pts.append(max_points)
        else:
            t = i / (n_stages - 1)
            pts.append(round(trostpreis + remaining * (t ** 1.5)))
    return pts


# ---------------------------------------------------------------------------
# Bracket generation
# ---------------------------------------------------------------------------

def _next_power_of_2(n: int) -> int:
    p = 1
    while p < n:
        p *= 2
    return p


def _generate_ko_matches(w: Wettkampf, db: Session) -> None:
    participants = list(w.participants)
    n = len(participants)
    if n < 2:
        raise HTTPException(400, "Mindestens 2 Teilnehmer für K.O.-System benötigt")

    participants.sort(key=lambda p: (p.seed is None, p.seed))

    for i, p in enumerate(participants):
        if p.seed is None:
            p.seed = i + 1

    size = _next_power_of_2(n)
    n_rounds = int(math.log2(size))

    stages = sorted(w.stages, key=lambda s: s.order)
    stage_by_round: dict[int, WettkampfStage] = {}
    for r in range(n_rounds):
        if r < len(stages) - 1:
            stage_by_round[r] = stages[r]

    slots: list[WettkampfTeilnehmer | None] = [None] * size
    for i, p in enumerate(participants):
        slots[i] = p

    for match_num in range(size // 2):
        p1 = slots[match_num * 2]
        p2 = slots[match_num * 2 + 1]
        stage = stage_by_round.get(0)
        m = WettkampfMatch(
            wettkampf_id=w.id,
            stage_id=stage.id if stage else None,
            round_number=0,
            match_number=match_num,
            p1_id=p1.id if p1 else None,
            p2_id=p2.id if p2 else None,
        )
        if p1 and not p2:
            m.winner_id = p1.id
        elif p2 and not p1:
            m.winner_id = p2.id
        db.add(m)

    db.flush()

    for r in range(1, n_rounds):
        n_matches = size // (2 ** (r + 1))
        stage = stage_by_round.get(r)
        for match_num in range(n_matches):
            m = WettkampfMatch(
                wettkampf_id=w.id,
                stage_id=stage.id if stage else None,
                round_number=r,
                match_number=match_num,
            )
            db.add(m)

    db.flush()
    _propagate_winners(w, db)


def _propagate_winners(w: Wettkampf, db: Session) -> None:
    matches_by_round: dict[int, list[WettkampfMatch]] = {}
    for m in w.matches:
        matches_by_round.setdefault(m.round_number, []).append(m)

    max_round = max(matches_by_round) if matches_by_round else 0

    for r in sorted(matches_by_round):
        if r >= max_round:
            break
        for m in sorted(matches_by_round[r], key=lambda x: x.match_number):
            if m.winner_id is None:
                continue
            next_match_num = m.match_number // 2
            next_round_matches = matches_by_round.get(r + 1, [])
            next_match = next((x for x in next_round_matches if x.match_number == next_match_num), None)
            if next_match is None:
                continue
            if m.match_number % 2 == 0:
                if next_match.p1_id is None:
                    next_match.p1_id = m.winner_id
            else:
                if next_match.p2_id is None:
                    next_match.p2_id = m.winner_id


def _generate_rr_matches(w: Wettkampf, db: Session) -> None:
    participants = list(w.participants)
    n = len(participants)
    if n < 2:
        raise HTTPException(400, "Mindestens 2 Teilnehmer für Jeder-gegen-Jeden benötigt")

    if n % 2 == 1:
        participants.append(None)  # type: ignore[arg-type]
        n += 1

    rounds = n - 1
    half = n // 2
    fixed = participants[0]
    rotating = participants[1:]
    stage = w.stages[0] if w.stages else None
    match_num = 0

    for r in range(rounds):
        for i in range(half):
            a = fixed if i == 0 else rotating[i - 1]
            b = rotating[n - 2 - i]
            if a is None or b is None:
                pass
            else:
                m = WettkampfMatch(
                    wettkampf_id=w.id,
                    stage_id=stage.id if stage else None,
                    round_number=r,
                    match_number=match_num,
                    p1_id=a.id,
                    p2_id=b.id,
                )
                db.add(m)
                match_num += 1
        rotating.append(rotating.pop(0))

    db.flush()


# ---------------------------------------------------------------------------
# Result helpers
# ---------------------------------------------------------------------------

def _compute_ko_standings(w: Wettkampf) -> dict[int, WettkampfStage]:
    """Legacy: map participants to stages based on K.O. rounds."""
    stages = sorted(w.stages, key=lambda s: s.order)
    if not stages:
        return {}

    matches_by_round: dict[int, list[WettkampfMatch]] = {}
    for m in w.matches:
        matches_by_round.setdefault(m.round_number, []).append(m)

    n_rounds = max(matches_by_round) + 1 if matches_by_round else 0

    stage_by_round: dict[int, WettkampfStage] = {}
    for r in range(n_rounds):
        if r < len(stages) - 1:
            stage_by_round[r] = stages[r]

    winner_stage = stages[-1]
    participant_stage: dict[int, WettkampfStage] = {}

    for r, ms in matches_by_round.items():
        for m in ms:
            if m.winner_id is None:
                continue
            loser_id = m.p1_id if m.winner_id == m.p2_id else m.p2_id
            stage = stage_by_round.get(r, stages[0])
            if loser_id and loser_id not in participant_stage:
                participant_stage[loser_id] = stage
            if m.winner_id not in participant_stage:
                participant_stage[m.winner_id] = stage

    if matches_by_round:
        last_round_matches = matches_by_round[n_rounds - 1]
        for m in last_round_matches:
            if m.winner_id:
                participant_stage[m.winner_id] = winner_stage

    return participant_stage


def _match_stats(w) -> dict:
    """Compute per-participant stats: W, D, L, GF, GA, Pts."""
    stats: dict[int, dict] = {
        p.id: {"w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0}
        for p in w.participants
    }

    def _try_int(v: str | None) -> int | None:
        try:
            return int(v) if v is not None else None
        except (ValueError, TypeError):
            return None

    for m in w.matches:
        if m.p1_id is None or m.p2_id is None:
            continue
        if m.p1_id not in stats or m.p2_id not in stats:
            continue
        s1 = _try_int(m.score_p1)
        s2 = _try_int(m.score_p2)

        if m.is_draw:
            stats[m.p1_id]["d"] += 1
            stats[m.p2_id]["d"] += 1
            if s1 is not None:
                stats[m.p1_id]["gf"] += s1
                stats[m.p2_id]["ga"] += s1
            if s2 is not None:
                stats[m.p2_id]["gf"] += s2
                stats[m.p1_id]["ga"] += s2
        elif m.winner_id in (m.p1_id, m.p2_id):
            loser_id = m.p2_id if m.winner_id == m.p1_id else m.p1_id
            stats[m.winner_id]["w"] += 1
            stats[loser_id]["l"] += 1
            if s1 is not None:
                stats[m.p1_id]["gf"] += s1
                stats[m.p2_id]["ga"] += s1
            if s2 is not None:
                stats[m.p2_id]["gf"] += s2
                stats[m.p1_id]["ga"] += s2

    wp, dp, lp = w.win_points, w.draw_points, w.loss_points
    for pid, s in stats.items():
        s["pts"] = s["w"] * wp + s["d"] * dp + s["l"] * lp
        s["gd"] = s["gf"] - s["ga"]
    return stats


def _compute_rr_standings(w: Wettkampf) -> dict[int, WettkampfStage]:
    """Legacy: rank by competition pts then map to stages."""
    stages = sorted(w.stages, key=lambda s: s.order)
    if not stages:
        return {}

    stats = _match_stats(w)
    ranked = sorted(
        w.participants,
        key=lambda p: (-stats[p.id]["pts"], -stats[p.id]["gd"], -stats[p.id]["gf"], p.name),
    )

    n = len(ranked)
    participant_stage: dict[int, WettkampfStage] = {}
    for i, p in enumerate(ranked):
        stage_idx = round(i / max(n - 1, 1) * (len(stages) - 1))
        stage_idx = len(stages) - 1 - stage_idx
        participant_stage[p.id] = stages[stage_idx]

    return participant_stage


# ---------------------------------------------------------------------------
# New placement-based ranking helpers
# ---------------------------------------------------------------------------

def _ko_exact_ranks(w: Wettkampf) -> dict[int, int]:
    """
    K.O. exact ranks:
    - Winner of final = rank 1
    - Loser of final = rank 2
    - Losers of semis = rank 3 (tied)
    - Losers of quarters = rank 5 (tied)
    Formula: losers of round r share rank = 2^(n_rounds-1-r) + 1
    """
    matches_by_round: dict[int, list[WettkampfMatch]] = {}
    for m in w.matches:
        matches_by_round.setdefault(m.round_number, []).append(m)
    if not matches_by_round:
        return {}

    n_rounds = max(matches_by_round) + 1
    ranks: dict[int, int] = {}

    for r, ms in matches_by_round.items():
        for m in ms:
            if m.winner_id is None:
                continue
            loser_id = m.p2_id if m.winner_id == m.p1_id else m.p1_id
            if loser_id:
                ranks[loser_id] = 2 ** (n_rounds - 1 - r) + 1
            if r == n_rounds - 1:
                ranks[m.winner_id] = 1

    return ranks


def _rr_exact_ranks(participants: list, stats: dict) -> dict[int, int]:
    """RR exact ranks with tie-breaking."""
    sorted_p = sorted(
        participants,
        key=lambda p: (-stats[p.id]["pts"], -stats[p.id]["gd"], -stats[p.id]["gf"], p.name),
    )
    ranks: dict[int, int] = {}
    for i, p in enumerate(sorted_p):
        if i > 0:
            prev = sorted_p[i - 1]
            s, sp = stats[p.id], stats[prev.id]
            same = s["pts"] == sp["pts"] and s["gd"] == sp["gd"] and s["gf"] == sp["gf"]
            ranks[p.id] = ranks[prev.id] if same else i + 1
        else:
            ranks[p.id] = 1
    return ranks


def _compute_ranks_for_pool(w: Wettkampf, participants: list) -> dict[int, int]:
    """Compute ranks for a subset of participants within a competition."""
    pid_set = {p.id for p in participants}

    if w.type == "knockout":
        all_ranks = _ko_exact_ranks(w)
        sub = {pid: r for pid, r in all_ranks.items() if pid in pid_set}
        sorted_ids = sorted(sub.keys(), key=lambda pid: sub[pid])
        return {pid: i + 1 for i, pid in enumerate(sorted_ids)}
    else:
        class _Sub:
            def __init__(self):
                self.participants = participants
                self.matches = [
                    m for m in w.matches
                    if m.p1_id in pid_set and m.p2_id in pid_set
                ]
                self.win_points = w.win_points
                self.draw_points = w.draw_points
                self.loss_points = w.loss_points

        stats = _match_stats(_Sub())
        return _rr_exact_ranks(participants, stats)


def _get_ranking_contexts(w: Wettkampf) -> list[dict]:
    """
    Returns list of {label, participants, weight} for each ranking context.
    Weight determines what fraction of max_points the context awards.
    """
    mode = w.ranking_mode
    all_p = list(w.participants)
    n_total = len(all_p)
    contexts: list[dict] = []

    has_overall = mode in ("overall", "both", "overall+gender")
    has_gender = "gender" in mode
    has_per_group = mode in ("per_group", "both", "per_group+gender")
    has_per_group_merged = mode in ("per_group_merged", "per_group_merged+gender")

    if has_overall:
        contexts.append({"label": "Gesamt", "participants": all_p, "weight": 1.0})

    if has_gender and not has_per_group and not has_per_group_merged:
        # Gender-only or overall+gender: add M/F sub-rankings
        for gender, label in [("m", "Männlich"), ("f", "Weiblich")]:
            pool = [p for p in all_p if p.gender == gender]
            if len(pool) >= 2:
                contexts.append({"label": f"Gesamt ({label})", "participants": pool, "weight": 0.5})

    if has_per_group_merged:
        groups: dict[str, list] = {}
        for p in all_p:
            key = _strip_stufe(p.group or "") or "?"
            groups.setdefault(key, []).append(p)
        for key, members in groups.items():
            w_g = len(members) / n_total if n_total > 0 else 1.0
            contexts.append({"label": f"Stufe {key}", "participants": members, "weight": w_g})
            if has_gender:
                for gender, glabel in [("m", "♂"), ("f", "♀")]:
                    gpool = [p for p in members if p.gender == gender]
                    if len(gpool) >= 2:
                        contexts.append({
                            "label": f"Stufe {key} {glabel}",
                            "participants": gpool,
                            "weight": 0.5 * w_g,
                        })
    elif has_per_group:
        groups2: dict[str, list] = {}
        for p in all_p:
            key = p.group or ""
            groups2.setdefault(key, []).append(p)
        for key, members in groups2.items():
            w_g = len(members) / n_total if n_total > 0 else 1.0
            label = f"Gruppe {key}" if key else "Ohne Gruppe"
            contexts.append({"label": label, "participants": members, "weight": w_g})
            if has_gender:
                for gender, glabel in [("m", "♂"), ("f", "♀")]:
                    gpool = [p for p in members if p.gender == gender]
                    if len(gpool) >= 2:
                        contexts.append({
                            "label": f"{label} {glabel}",
                            "participants": gpool,
                            "weight": 0.5 * w_g,
                        })

    # Fall back: if no contexts (e.g. mode="gender" with no gender data), use overall
    if not contexts:
        contexts.append({"label": "Gesamt", "participants": all_p, "weight": 1.0})

    return contexts


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/api/wettkampf")
def list_wettkampf(db: Session = Depends(get_db)):
    ws = db.query(Wettkampf).order_by(Wettkampf.created_at.desc()).all()
    return [_ser_wettkampf(w) for w in ws]


@router.post("/api/wettkampf", status_code=201)
def create_wettkampf(
    body: WettkampfCreate,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    if body.type not in ("knockout", "round_robin", "pairing"):
        raise HTTPException(400, "type muss 'knockout', 'round_robin' oder 'pairing' sein")
    if body.trostpreis_points >= body.max_points:
        raise HTTPException(400, "trostpreis_points muss kleiner als max_points sein")
    if body.ranking_mode not in VALID_RANKING_MODES:
        raise HTTPException(400, f"Ungültiger ranking_mode: {body.ranking_mode}")

    preset = SCORING_PRESETS.get(body.scoring_system, SCORING_PRESETS["soccer"])
    w = Wettkampf(
        title=body.title,
        description=body.description,
        type=body.type,
        max_points=body.max_points,
        trostpreis_points=body.trostpreis_points,
        rewarded_places=body.rewarded_places,
        scoring_system=body.scoring_system,
        win_points=body.win_points if body.win_points is not None else preset["win_points"],
        draw_points=body.draw_points if body.draw_points is not None else preset["draw_points"],
        loss_points=body.loss_points if body.loss_points is not None else preset["loss_points"],
        ranking_mode=body.ranking_mode,
    )
    db.add(w)
    db.flush()

    if body.stages:
        for s in body.stages:
            db.add(WettkampfStage(wettkampf_id=w.id, name=s.name, order=s.order, points=s.points))
    db.commit()
    db.refresh(w)
    return _ser_wettkampf(w)


@router.get("/api/wettkampf/{wid}")
def get_wettkampf(wid: int, db: Session = Depends(get_db)):
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    return _ser_wettkampf(w, include_matches=True)


@router.put("/api/wettkampf/{wid}")
def update_wettkampf(
    wid: int,
    body: WettkampfUpdate,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    if body.title is not None:
        w.title = body.title
    if body.description is not None:
        w.description = body.description
    if body.max_points is not None:
        w.max_points = body.max_points
    if body.trostpreis_points is not None:
        w.trostpreis_points = body.trostpreis_points
    if "rewarded_places" in body.model_fields_set:
        w.rewarded_places = body.rewarded_places
    if body.ranking_mode is not None:
        if body.ranking_mode not in VALID_RANKING_MODES:
            raise HTTPException(400, f"Ungültiger ranking_mode: {body.ranking_mode}")
        w.ranking_mode = body.ranking_mode
    if body.scoring_system is not None:
        w.scoring_system = body.scoring_system
        preset = SCORING_PRESETS.get(body.scoring_system, SCORING_PRESETS["soccer"])
        w.win_points = body.win_points if body.win_points is not None else preset["win_points"]
        w.draw_points = body.draw_points if body.draw_points is not None else preset["draw_points"]
        w.loss_points = body.loss_points if body.loss_points is not None else preset["loss_points"]
    else:
        if body.win_points is not None:
            w.win_points = body.win_points
        if body.draw_points is not None:
            w.draw_points = body.draw_points
        if body.loss_points is not None:
            w.loss_points = body.loss_points
    db.commit()
    db.refresh(w)
    return _ser_wettkampf(w, include_matches=True)


@router.delete("/api/wettkampf/{wid}", status_code=204)
def delete_wettkampf(
    wid: int,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    db.delete(w)
    db.commit()


# ── Participants ─────────────────────────────────────────────────────────────

@router.post("/api/wettkampf/{wid}/participants", status_code=201)
def add_participant(
    wid: int,
    body: ParticipantIn,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    if w.status != "draft":
        raise HTTPException(409, "Teilnehmer können nur im Entwurfsstatus hinzugefügt werden")
    p = WettkampfTeilnehmer(
        wettkampf_id=wid,
        name=body.name,
        seed=body.seed,
        group=body.group,
        gender=body.gender,
        class_id=body.class_id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _ser_participant(p)


@router.patch("/api/wettkampf/{wid}/participants/{pid}")
def update_participant(
    wid: int,
    pid: int,
    body: ParticipantUpdate,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    p = db.query(WettkampfTeilnehmer).filter_by(id=pid, wettkampf_id=wid).first()
    if not p:
        raise HTTPException(404, "Teilnehmer nicht gefunden")
    if body.group is not None:
        p.group = body.group or None
    if "gender" in body.model_fields_set:
        p.gender = body.gender
    db.commit()
    db.refresh(p)
    return _ser_participant(p)


@router.delete("/api/wettkampf/{wid}/participants/{pid}", status_code=204)
def remove_participant(
    wid: int,
    pid: int,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    p = db.query(WettkampfTeilnehmer).filter_by(id=pid, wettkampf_id=wid).first()
    if not p:
        raise HTTPException(404, "Teilnehmer nicht gefunden")
    db.delete(p)
    db.commit()


# ── Stages ───────────────────────────────────────────────────────────────────

@router.put("/api/wettkampf/{wid}/stages")
def set_stages(
    wid: int,
    body: StagesUpdate,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    for s in w.stages:
        db.delete(s)
    db.flush()
    for s in body.stages:
        db.add(WettkampfStage(wettkampf_id=wid, name=s.name, order=s.order, points=s.points))
    db.commit()
    db.refresh(w)
    return _ser_wettkampf(w)


@router.get("/api/wettkampf/{wid}/suggest-stages")
def suggest_stages(wid: int, db: Session = Depends(get_db)):
    """Return auto-generated stage suggestions based on current participant count."""
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    n = len(w.participants)
    if n < 2:
        raise HTTPException(400, "Mindestens 2 Teilnehmer benötigt")

    if w.type == "knockout":
        names = _ko_stage_names(n)
    else:
        names = [f"Platz {n - i}" for i in range(n)]
        names[-1] = "Sieger"

    pts = _suggest_points(len(names), w.max_points, w.trostpreis_points)
    return [
        {"name": name, "order": i, "points": pts[i]}
        for i, name in enumerate(names)
    ]


@router.get("/api/wettkampf/{wid}/suggest-placements")
def suggest_placements(wid: int, n: int, db: Session = Depends(get_db)):
    """Return suggested points for n rewarded places using the formula."""
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    if n < 1 or n > 50:
        raise HTTPException(400, "n muss zwischen 1 und 50 liegen")
    pts = _placement_points(n, w.max_points, w.trostpreis_points)
    return [
        {"place": i + 1, "name": f"Platz {i + 1}", "points": pts[i]}
        for i in range(n)
    ]


# ── Generate bracket ─────────────────────────────────────────────────────────

@router.post("/api/wettkampf/{wid}/generate")
def generate_bracket(
    wid: int,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    if w.status != "draft":
        raise HTTPException(409, "Bracket bereits generiert")
    if len(w.participants) < 2:
        raise HTTPException(400, "Mindestens 2 Teilnehmer benötigt")
    # Stages only required when using legacy stage-based points (no rewarded_places set)
    if not w.stages and w.type != "pairing" and w.rewarded_places is None:
        raise HTTPException(400, "Bitte erst Belohnte Plätze festlegen oder Stufen konfigurieren")

    if w.type == "knockout":
        _generate_ko_matches(w, db)
    elif w.type == "round_robin":
        _generate_rr_matches(w, db)

    w.status = "active"
    db.commit()
    db.refresh(w)
    return _ser_wettkampf(w, include_matches=True)


# ── Match results ─────────────────────────────────────────────────────────────

@router.put("/api/wettkampf/{wid}/matches/{mid}/result")
def set_match_result(
    wid: int,
    mid: int,
    body: MatchResultIn,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    m = db.query(WettkampfMatch).filter_by(id=mid, wettkampf_id=wid).first()
    if not m:
        raise HTTPException(404, "Begegnung nicht gefunden")
    w = db.get(Wettkampf, wid)
    if w.status != "active":
        raise HTTPException(409, "Wettkampf ist nicht aktiv")
    if not body.is_draw and body.winner_id not in (m.p1_id, m.p2_id):
        raise HTTPException(400, "winner_id muss p1 oder p2 sein")

    m.is_draw = body.is_draw
    m.winner_id = None if body.is_draw else body.winner_id
    m.score_p1 = body.score_p1
    m.score_p2 = body.score_p2
    db.flush()

    if w.type == "knockout":
        db.expire(w)
        w = db.get(Wettkampf, wid)
        _propagate_winners(w, db)

    db.commit()
    db.refresh(w)
    return _ser_wettkampf(w, include_matches=True)


# ── Manual match creation (pairing type) ─────────────────────────────────────

class MatchCreateIn(BaseModel):
    round_number: int
    p1_id: int
    p2_id: int


@router.post("/api/wettkampf/{wid}/matches", status_code=201)
def add_match(
    wid: int,
    body: MatchCreateIn,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    if w.type != "pairing":
        raise HTTPException(409, "Manuelle Begegnungen nur bei Paarungsturnier möglich")
    if w.status != "active":
        raise HTTPException(409, "Wettkampf ist nicht aktiv")
    if body.p1_id == body.p2_id:
        raise HTTPException(400, "p1 und p2 müssen verschieden sein")
    participant_ids = {p.id for p in w.participants}
    if body.p1_id not in participant_ids or body.p2_id not in participant_ids:
        raise HTTPException(400, "Unbekannte Teilnehmer-ID")
    existing = [m for m in w.matches if m.round_number == body.round_number]
    match_num = len(existing)
    stage = w.stages[0] if w.stages else None
    m = WettkampfMatch(
        wettkampf_id=wid,
        stage_id=stage.id if stage else None,
        round_number=body.round_number,
        match_number=match_num,
        p1_id=body.p1_id,
        p2_id=body.p2_id,
    )
    db.add(m)
    db.commit()
    db.refresh(w)
    return _ser_wettkampf(w, include_matches=True)


# ── Auto-pair within a group (round-robin) ────────────────────────────────────

class AutoPairIn(BaseModel):
    group: str | None = None


@router.post("/api/wettkampf/{wid}/auto-pair", status_code=201)
def auto_pair(
    wid: int,
    body: AutoPairIn,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    if w.type != "pairing":
        raise HTTPException(409, "Auto-Paarung nur bei Paarungsturnier")
    if w.status not in ("draft", "active"):
        raise HTTPException(409, "Wettkampf ist bereits abgeschlossen")

    members = [p for p in w.participants if p.group == body.group]
    if len(members) < 2:
        raise HTTPException(400, "Mindestens 2 Teilnehmer in der Gruppe erforderlich")

    existing_rounds = {m.round_number for m in w.matches}
    next_round = (max(existing_rounds) + 1) if existing_rounds else 0

    existing_pairs = {(min(m.p1_id, m.p2_id), max(m.p1_id, m.p2_id)) for m in w.matches}

    stage = w.stages[0] if w.stages else None
    created = 0

    players = list(members)
    n = len(players)
    if n % 2 == 1:
        players.append(None)
    half = len(players) // 2
    rotating = players[1:]

    for r in range(len(players) - 1):
        round_matches = []
        circle = [players[0]] + rotating
        for i in range(half):
            a, b = circle[i], circle[len(circle) - 1 - i]
            if a is None or b is None:
                continue
            pair = (min(a.id, b.id), max(a.id, b.id))
            if pair not in existing_pairs:
                round_matches.append((a, b))
                existing_pairs.add(pair)
        for match_num, (a, b) in enumerate(round_matches):
            db.add(WettkampfMatch(
                wettkampf_id=wid,
                stage_id=stage.id if stage else None,
                round_number=next_round + r,
                match_number=match_num,
                p1_id=a.id,
                p2_id=b.id,
            ))
            created += 1
        rotating.append(rotating.pop(0))

    db.commit()
    db.refresh(w)
    return {**_ser_wettkampf(w, include_matches=True), "created": created}


@router.delete("/api/wettkampf/{wid}/matches/{mid}", status_code=204)
def delete_match(
    wid: int,
    mid: int,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    m = db.query(WettkampfMatch).filter_by(id=mid, wettkampf_id=wid).first()
    if not m:
        raise HTTPException(404, "Begegnung nicht gefunden")
    w = db.get(Wettkampf, wid)
    if w.type != "pairing":
        raise HTTPException(409, "Begegnungen können nur bei Paarungsturnier gelöscht werden")
    db.delete(m)
    db.commit()


# ── Finish and award points ───────────────────────────────────────────────────

@router.get("/api/wettkampf/{wid}/results")
def get_wettkampf_results(wid: int, db: Session = Depends(get_db)):
    """Dry-run recompute of awarded points for a finished wettkampf (no DB writes)."""
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    if w.status != "finished":
        raise HTTPException(409, "Wettkampf ist noch nicht abgeschlossen")

    n = w.rewarded_places if w.rewarded_places is not None else max(1, len(w.participants) // 2)
    trost = float(w.trostpreis_points)
    max_pts = float(w.max_points)
    contexts = _get_ranking_contexts(w)

    total_pts: dict[int, float] = {p.id: 0.0 for p in w.participants}
    context_labels: dict[int, list[str]] = {p.id: [] for p in w.participants}

    for ctx in contexts:
        members = ctx["participants"]
        weight = ctx["weight"]
        label = ctx["label"]
        if len(members) < 1:
            continue
        ranks = _compute_ranks_for_pool(w, members)
        place_pts = _placement_points(n, max_pts, trost)
        for p in members:
            rank = ranks.get(p.id)
            if rank is not None and rank <= n:
                pts = place_pts[rank - 1] * weight
                context_labels[p.id].append(f"{label}: Platz {rank} ({pts:.0f} Pkt)")
            else:
                pts = trost * weight
                context_labels[p.id].append(f"{label}: Teilnahme ({pts:.0f} Pkt)")
            total_pts[p.id] = total_pts.get(p.id, 0.0) + pts

    individual_stats = _match_stats(w)
    awarded = []
    for p in w.participants:
        pts = total_pts.get(p.id, trost)
        awarded.append({
            "participant": _ser_participant(p),
            "stage": None,
            "points": int(round(pts)),
            "detail": context_labels.get(p.id, []),
        })
    class_awarded = _compute_class_awards(w, individual_stats, max_pts, trost)
    return {"awarded": awarded, "class_awarded": class_awarded}


@router.post("/api/wettkampf/{wid}/finish")
def finish_wettkampf(
    wid: int,
    body: FinishIn = FinishIn(),
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    w = db.get(Wettkampf, wid)
    if not w:
        raise HTTPException(404, "Wettkampf nicht gefunden")
    if w.status != "active":
        raise HTTPException(409, "Wettkampf ist nicht aktiv")

    if w.type != "pairing":
        open_matches = [m for m in w.matches if m.winner_id is None and not m.is_draw and m.p1_id and m.p2_id]
        if open_matches:
            raise HTTPException(409, f"Noch {len(open_matches)} offene Begegnung(en)")

    # ── Manual points override (pairing type) ──
    if body.manual_points:
        manual_map = {e.participant_id: e.points for e in body.manual_points}
        awarded: list[dict] = []
        for p in w.participants:
            points = manual_map.get(p.id, w.trostpreis_points)
            if p.class_id:
                db.add(Transaction(
                    teacher_id=teacher.id,
                    class_id=p.class_id,
                    points=int(round(points)),
                    reason=f"Wettkampf: {w.title} – Manuell",
                ))
            awarded.append({"participant": _ser_participant(p), "stage": None, "points": points})
        w.status = "finished"
        db.commit()
        return {"awarded": awarded}

    # ── Placement-formula based awarding (new system) ──
    # Also use this path when no stages defined (legacy path would give everyone trostpreis)
    if w.rewarded_places is not None or not w.stages:
        n = w.rewarded_places if w.rewarded_places is not None else max(1, len(w.participants) // 2)
        trost = float(w.trostpreis_points)
        max_pts = float(w.max_points)
        contexts = _get_ranking_contexts(w)

        # Accumulate points per participant across all contexts
        total_pts: dict[int, float] = {p.id: 0.0 for p in w.participants}
        context_labels: dict[int, list[str]] = {p.id: [] for p in w.participants}

        for ctx in contexts:
            members = ctx["participants"]
            weight = ctx["weight"]
            label = ctx["label"]
            if len(members) < 1:
                continue

            ranks = _compute_ranks_for_pool(w, members)
            place_pts = _placement_points(n, max_pts, trost)

            for p in members:
                rank = ranks.get(p.id)
                if rank is not None and rank <= n:
                    pts = place_pts[rank - 1] * weight
                    context_labels[p.id].append(f"{label}: Platz {rank} ({pts:.0f} Pkt)")
                else:
                    pts = trost * weight
                    context_labels[p.id].append(f"{label}: Teilnahme ({pts:.0f} Pkt)")
                total_pts[p.id] = total_pts.get(p.id, 0.0) + pts

        awarded = []
        for p in w.participants:
            pts = total_pts.get(p.id, trost)
            pts_int = int(round(pts))
            reason_detail = "; ".join(context_labels.get(p.id, []))
            if p.class_id:
                db.add(Transaction(
                    teacher_id=teacher.id,
                    class_id=p.class_id,
                    points=pts_int,
                    reason=f"Wettkampf: {w.title} – {reason_detail}",
                ))
            awarded.append({
                "participant": _ser_participant(p),
                "stage": None,
                "points": pts,
                "detail": context_labels.get(p.id, []),
            })

        individual_stats = _match_stats(w)
        class_awarded = _compute_class_awards(w, individual_stats, max_pts, trost)
        w.status = "finished"
        db.commit()
        return {"awarded": awarded, "class_awarded": class_awarded}

    # ── Legacy stage-based awarding ──
    if w.type == "knockout":
        overall_standings = _compute_ko_standings(w)
    else:
        overall_standings = _compute_rr_standings(w)

    def _group_standings() -> dict[int, WettkampfStage]:
        groups: dict[str, list] = {}
        for p in w.participants:
            g = p.group or ""
            groups.setdefault(g, []).append(p)
        result: dict[int, WettkampfStage] = {}
        for g, members in groups.items():
            sub = Wettkampf.__new__(Wettkampf)
            sub.__dict__.update(w.__dict__)
            member_ids = {p.id for p in members}
            sub.__dict__['participants'] = members
            sub.__dict__['matches'] = [m for m in w.matches if
                           m.p1_id in member_ids and
                           m.p2_id in member_ids]
            result.update(_compute_rr_standings(sub) if w.type != "knockout" else _compute_ko_standings(sub))
        return result

    ranking_mode = getattr(w, "ranking_mode", "overall")
    if ranking_mode in ("per_group", "per_group+gender", "per_group_merged", "per_group_merged+gender"):
        standings_map = _group_standings()
    elif ranking_mode == "both":
        group_standings = _group_standings()
    else:
        standings_map = overall_standings

    awarded = []
    for p in w.participants:
        if ranking_mode == "both":
            g_stage = group_standings.get(p.id)
            o_stage = overall_standings.get(p.id)
            g_pts = g_stage.points if g_stage else w.trostpreis_points
            o_pts = o_stage.points if o_stage else w.trostpreis_points
            total_points = g_pts + o_pts
            reason_parts = []
            if g_stage:
                reason_parts.append(f"Gruppe: {g_stage.name}")
            if o_stage:
                reason_parts.append(f"Gesamt: {o_stage.name}")
            reason = f"Wettkampf: {w.title} – " + " + ".join(reason_parts) if reason_parts else f"Wettkampf: {w.title} – Teilnahme"
            if p.class_id:
                db.add(Transaction(
                    teacher_id=teacher.id,
                    class_id=p.class_id,
                    points=int(round(total_points)),
                    reason=reason,
                ))
            awarded.append({
                "participant": _ser_participant(p),
                "stage": _ser_stage(g_stage) if g_stage else (_ser_stage(o_stage) if o_stage else None),
                "points": total_points,
            })
        else:
            stage = standings_map.get(p.id)
            points = stage.points if stage else w.trostpreis_points
            if p.class_id:
                db.add(Transaction(
                    teacher_id=teacher.id,
                    class_id=p.class_id,
                    points=int(round(points)),
                    reason=f"Wettkampf: {w.title} – {stage.name if stage else 'Teilnahme'}",
                ))
            awarded.append({
                "participant": _ser_participant(p),
                "stage": _ser_stage(stage) if stage else None,
                "points": points,
            })

    w.status = "finished"
    db.commit()
    return {"awarded": awarded}
