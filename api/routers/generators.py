"""
Admin CRUD for declarative task generators (TaskGeneratorDef) — lets an
admin register a new practice/Übungsseite topic without a code change or
any code-execution surface (see api/expr_eval.py for the safety contract).

GET /api/generators is public-to-teachers (not just admin): it lists every
registered generator, built-in (api/task_generators.py) and custom, for the
TaskCrawler library's "welche Generatoren gibt es" hint panel.
"""
import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import task_generators
from ..database import get_db
from ..expr_eval import eval_expr, render_template
from ..models import TaskGeneratorDef, Teacher
from ..auth import get_current_teacher
from ..admin_access import require_admin_feature

router = APIRouter(tags=["generators"])

LEVEL_MIN, LEVEL_MAX_COUNT = 1, 5


class LevelIn(BaseModel):
    template: str
    vars: dict[str, list[int]]  # name -> [min, max]
    answer_expr: str
    hint: str | None = None


class GeneratorIn(BaseModel):
    slug: str
    label: str
    subject: str
    description: str = ""
    levels: list[LevelIn]


def _validate_and_test(levels: list[LevelIn]) -> list[str]:
    errors = []
    if not (LEVEL_MIN <= len(levels) <= LEVEL_MAX_COUNT):
        errors.append(f"'levels' braucht 1 bis {LEVEL_MAX_COUNT} Stufen (empfohlen 5)")
        return errors
    for i, level in enumerate(levels):
        where = f"levels[{i}]"
        if not level.vars:
            errors.append(f"{where}: 'vars' darf nicht leer sein")
            continue
        for name, rng in level.vars.items():
            if len(rng) != 2 or rng[0] > rng[1]:
                errors.append(f"{where}.vars['{name}']: erwartet [min, max] mit min <= max")
        # Actually generate and check the template/expr at both extremes.
        for corner in ({n: r[0] for n, r in level.vars.items()},
                        {n: r[1] for n, r in level.vars.items()}):
            try:
                render_template(level.template, corner)
                eval_expr(level.answer_expr, corner)
            except ValueError as e:
                errors.append(f"{where}: {e}")
                break
    return errors


@router.get("/api/generators")
def list_generators(db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    built_in = [
        {"id": g.id, "label": g.label, "subject": g.subject, "description": g.description,
         "grades": g.grades, "source": "built-in"}
        for g in task_generators.REGISTRY.values()
    ]
    custom = [
        {"id": d.slug, "label": d.label, "subject": d.subject, "description": d.description,
         "grades": [], "source": "custom"}
        for d in db.query(TaskGeneratorDef).order_by(TaskGeneratorDef.label).all()
    ]
    return built_in + custom


@router.get("/api/generators/{gen_id}/sample")
def sample_generator(
    gen_id: str, difficulty: int = 3, count: int = 5,
    db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher),
):
    """Generate `count` task instances at one difficulty — the reuse hook for
    other tools: a Caputh quiz builder can turn question+accept+distractors
    into single-choice questions, a Bingo set can use question/solution as
    caller/answer pairs, and the admin UI can preview a generator. Purely
    read-only: nothing is stored, no practice progress is touched."""
    count = max(1, min(count, 25))
    difficulty = max(task_generators.DIFFICULTY_MIN, min(task_generators.DIFFICULTY_MAX, difficulty))
    custom_def = None
    if gen_id not in task_generators.REGISTRY:
        custom_def = db.query(TaskGeneratorDef).filter_by(slug=gen_id).first()
        if not custom_def:
            raise HTTPException(404, "Generator nicht gefunden")
    rng = random.Random()
    out = []
    for _i in range(count):
        t = generate_from_def(custom_def, difficulty, rng) if custom_def else \
            task_generators.generate_task(gen_id, difficulty, rng)
        out.append({
            "question": t["question"], "accept": t["accept"],
            "solution": t.get("solution") or (t["accept"][0] if t["accept"] else None),
            "hint": t.get("hint"), "image_svg": t.get("image_svg"),
            "distractors": t.get("distractors", []),
        })
    return {"generator": gen_id, "difficulty": difficulty, "tasks": out}


@router.post("/api/admin/generators", status_code=201)
def create_generator(body: GeneratorIn, db: Session = Depends(get_db), current: Teacher = Depends(require_admin_feature("generators"))):
    slug = body.slug.strip().lower()
    if not slug or not slug.replace("_", "").replace("-", "").isalnum():
        raise HTTPException(400, "slug: nur Kleinbuchstaben, Zahlen, '-' und '_'")
    if slug in task_generators.REGISTRY:
        raise HTTPException(400, f"slug '{slug}' ist bereits ein eingebauter Generator")
    errors = _validate_and_test(body.levels)
    if errors:
        raise HTTPException(422, {"message": "Ungültige Generator-Definition", "errors": errors})

    existing = db.query(TaskGeneratorDef).filter_by(slug=slug).first()
    if existing:
        existing.label, existing.subject, existing.description = body.label, body.subject, body.description
        existing.levels = [lv.model_dump() for lv in body.levels]
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "slug": existing.slug}

    d = TaskGeneratorDef(
        slug=slug, label=body.label, subject=body.subject, description=body.description,
        levels=[lv.model_dump() for lv in body.levels], created_by=current.id,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return {"id": d.id, "slug": d.slug}


@router.get("/api/admin/generators")
def list_admin_generators(db: Session = Depends(get_db), _: Teacher = Depends(require_admin_feature("generators"))):
    defs = db.query(TaskGeneratorDef).order_by(TaskGeneratorDef.label).all()
    return [
        {"id": d.id, "slug": d.slug, "label": d.label, "subject": d.subject,
         "description": d.description, "levels": d.levels, "created_at": d.created_at.isoformat()}
        for d in defs
    ]


@router.delete("/api/admin/generators/{slug}", status_code=204)
def delete_generator(slug: str, db: Session = Depends(get_db), _: Teacher = Depends(require_admin_feature("generators"))):
    d = db.query(TaskGeneratorDef).filter_by(slug=slug).first()
    if not d:
        raise HTTPException(404, "Generator nicht gefunden")
    db.delete(d)
    db.commit()


def generate_from_def(gen_def: TaskGeneratorDef, difficulty: int, rng: random.Random) -> dict:
    """Same return shape as api/task_generators.py's generate() functions —
    used by the practice router alongside the built-in registry."""
    idx = max(0, min(difficulty, len(gen_def.levels)) - 1)
    level = gen_def.levels[idx]
    values = {name: rng.randint(r[0], r[1]) for name, r in level["vars"].items()}
    question = render_template(level["template"], values)
    answer = eval_expr(level["answer_expr"], values)
    accept = str(int(answer)) if float(answer).is_integer() else str(answer)
    return {"question": question, "accept": [accept], "hint": level.get("hint")}
