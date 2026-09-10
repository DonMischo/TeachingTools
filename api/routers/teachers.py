import csv
import io
import random
import re

import chardet
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Teacher, TeacherAssignment, TeacherRole, Class, StudentGroup, SubjectWochenstunden
from ..schemas import (
    TeacherOut, TeacherAssignmentOut, TeacherPreviewResponse, TeacherApplyRequest,
    TeacherCredentialRow, WochenstundenOut, WochenstundenSet, TeacherKorrekturIn,
)
from ..auth import get_current_teacher, get_current_user, hash_password, require_admin, verify_password
from ..admin_access import require_admin_feature
from ..audit import audit
from .twofa import require_totp
from ..password_gen import generate_password
from ..pw_crypto import encrypt as _pw_encrypt, display_password as _display_password
from ..seed import GRADES as _KNOWN_GRADES

router = APIRouter(prefix="/api/teachers", tags=["teachers"])

_TRUTHY = {"1", "true", "ja", "yes"}
# Kurs assignments (Klasse 9/10 Kurssystem) and Wahlpflicht groups aren't tied
# to one grade — use this as the representative grade for Wochenstunden lookup.
_GROUP_ASSIGNMENT_GRADE = 9


def _extract_grade(code: str) -> int | None:
    m = re.match(r'^(\d+)', code or "")
    return int(m.group(1)) if m else None


def _ws_lookup(db: Session) -> dict[tuple[str, int], int]:
    return {(w.subject, w.grade): w.hours for w in db.query(SubjectWochenstunden).all()}


def _assignment_out(a: TeacherAssignment) -> TeacherAssignmentOut:
    if a.group_id and a.group:
        # Kurs/Wahlpflicht: "Ma I" (group named after the level)
        label = f"{a.subject} {a.group.name}"
        return TeacherAssignmentOut(
            id=a.id, subject=a.subject, group_id=a.group_id,
            group_name=a.group.name, group_type=a.group.group_type, label=label,
        )
    return TeacherAssignmentOut(
        id=a.id, subject=a.subject, class_id=a.class_id,
        class_code=a.class_.code if a.class_ else None,
        label=f"{a.class_.code if a.class_ else '?'} · {a.subject}",
    )


def _assignment_hours(a: TeacherAssignment, ws: dict[tuple[str, int], int]) -> int:
    if a.group_id:
        return ws.get((a.subject, _GROUP_ASSIGNMENT_GRADE), 0)
    grade = _extract_grade(a.class_.code) if a.class_ else None
    return ws.get((a.subject, grade), 0) if grade is not None else 0


def _teacher_out(t: Teacher, ws: dict[tuple[str, int], int] | None = None) -> TeacherOut:
    ws = ws if ws is not None else {}
    total_ws = sum(_assignment_hours(a, ws) for a in t.assignments) + t.korrektur
    return TeacherOut(
        id=t.id, first_name=t.first_name, last_name=t.last_name, active=t.active, role=t.role,
        username=t.username, nummer=t.nummer, email=t.email,
        teacher_role=t.teacher_role.name if t.teacher_role else None,
        klasse=t.klasse.code if t.klasse else None,
        klasse_id=t.klasse_id,
        assignments=[_assignment_out(a) for a in t.assignments],
        korrektur=t.korrektur, notiz=t.notiz, av_stunden=t.av_stunden, total_ws=total_ws,
    )


# ---------------------------------------------------------------------------
# Credential generation (username + password), mirroring api/routers/students.py
# ---------------------------------------------------------------------------

_UMLAUT = str.maketrans({"ä": "a", "ö": "o", "ü": "u", "Ä": "a", "Ö": "o", "Ü": "u", "ß": "ss"})


def _normalize_name_part(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower().translate(_UMLAUT))


def _make_username(first_name: str, last_name: str, existing: set[str]) -> str:
    initial = _normalize_name_part(first_name)[:1] or "x"
    last = _normalize_name_part(last_name) or "lehrer"
    base = f"{initial}.{last}"
    for _ in range(200):
        username = f"{base}{random.randint(10, 99)}"
        if username not in existing:
            return username
    raise RuntimeError(f"Cannot generate unique username for {first_name} {last_name}")


def _mint_teacher_credentials(t: Teacher, existing: set[str]) -> str | None:
    """Give the teacher a username and password if missing. Returns the plaintext
    password when known (freshly generated, or re-derivable from the stored seed),
    else None. Never overwrites a manually-set password (seed is None)."""
    needs_pw = not t.password_hash or (
        t.password_seed is not None
        and not verify_password(generate_password(t.password_seed), t.password_hash)
    )
    if not t.username:
        t.username = _make_username(t.first_name, t.last_name, existing)
        existing.add(t.username)
    if needs_pw:
        seed = random.randint(1, 999_999)
        plain = generate_password(seed)
        t.password_seed = seed
        t.password_hash = hash_password(plain)
        t.password_enc = _pw_encrypt(plain)
        return plain
    # Displayable if generated (seed or encrypted); None for a manually-set password.
    return _display_password(t) or None


def _reset_teacher_password(t: Teacher, existing: set[str]) -> str:
    """Force a brand-new password (and username if missing). Returns the plaintext."""
    if not t.username:
        t.username = _make_username(t.first_name, t.last_name, existing)
        existing.add(t.username)
    seed = random.randint(1, 999_999)
    plain = generate_password(seed)
    t.password_seed = seed
    t.password_hash = hash_password(plain)
    t.password_enc = _pw_encrypt(plain)
    return plain


def encrypt_seed_passwords_teachers(db: Session) -> int:
    """Migrate seed-based teacher passwords to encrypted-at-rest and drop the seed
    (idempotent); mirrors students.encrypt_seed_passwords. Caller commits."""
    rows = db.query(Teacher).filter(Teacher.password_seed.isnot(None)).all()
    migrated = 0
    for t in rows:
        if not t.password_hash:
            continue
        plain = generate_password(t.password_seed)
        if not verify_password(plain, t.password_hash):
            continue
        if not t.password_enc:
            t.password_enc = _pw_encrypt(plain)
        t.password_seed = None
        migrated += 1
    return migrated


def _ohne_deputat(out: TeacherOut) -> TeacherOut:
    """Dieselbe Lehrkraft ohne ihre Arbeitszeitdaten.

    Name, Fach, Klasse und Mailadresse stehen auf der Schulhomepage — die
    duerfen bleiben. ``korrektur``, ``notiz`` und ``av_stunden`` (Stunden nach
    Arbeitsvertrag) stehen dort nicht: das ist die Deputatsrechnung aus der
    Lehrerdatenverwaltung, also Beschaeftigtendaten, und die gehen Schueler
    nichts an. ``total_ws`` faellt mit, weil es die Summe daraus ist —
    andernfalls liesse sich ``korrektur`` daraus zurueckrechnen.

    Die Personalnummer und der Anmeldename gehen ebenfalls nicht raus: beides
    sind interne Kennungen, keine Kontaktdaten.
    """
    out.korrektur = 0
    out.notiz = None
    out.av_stunden = None
    out.total_ws = 0
    out.nummer = None
    out.username = None
    return out


@router.get("", response_model=list[TeacherOut])
def list_teachers(db: Session = Depends(get_db), viewer=Depends(get_current_user)):
    """Das Kollegium. Der einzige Weg, auf dem eine TeacherOut bei jemandem
    landen kann, der selbst keine Lehrkraft ist — alle anderen Routen mit
    diesem Schema haengen an get_current_teacher oder am Recht »Lehrerdaten«."""
    teachers = db.query(Teacher).filter(Teacher.active == True).order_by(Teacher.last_name, Teacher.first_name).all()
    ws = _ws_lookup(db)
    voll = isinstance(viewer, Teacher)
    return [_teacher_out(t, ws) if voll else _ohne_deputat(_teacher_out(t, ws))
            for t in teachers]


# ---------------------------------------------------------------------------
# Wochenstunden config (admin only)
# ---------------------------------------------------------------------------

@router.get("/wochenstunden", response_model=list[WochenstundenOut])
def get_wochenstunden(db: Session = Depends(get_db), _: object = Depends(require_admin_feature("teachers"))):
    return db.query(SubjectWochenstunden).all()


@router.put("/wochenstunden", response_model=list[WochenstundenOut])
def set_wochenstunden(body: list[WochenstundenSet], db: Session = Depends(get_db), _: object = Depends(require_admin_feature("teachers"))):
    for item in body:
        row = db.query(SubjectWochenstunden).filter_by(subject=item.subject, grade=item.grade).first()
        if row:
            row.hours = item.hours
        else:
            db.add(SubjectWochenstunden(subject=item.subject, grade=item.grade, hours=item.hours))
    db.commit()
    return db.query(SubjectWochenstunden).all()


@router.patch("/{teacher_id}/korrektur", response_model=TeacherOut)
def set_korrektur(
    teacher_id: int,
    body: TeacherKorrekturIn,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("teachers")),
):
    t = db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(404, "Teacher not found")
    t.korrektur = body.korrektur
    t.notiz = (body.notiz or "").strip() or None
    if body.av_stunden is not None or body.clear_av_stunden:
        t.av_stunden = None if body.clear_av_stunden else body.av_stunden
    db.commit()
    db.refresh(t)
    return _teacher_out(t, _ws_lookup(db))


@router.post("/import", response_model=list[TeacherOut])
def import_teachers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("teachers")),
):
    content = file.file.read().decode("utf-8-sig")  # strip BOM if present
    reader = csv.DictReader(io.StringIO(content))
    # Normalize column names
    reader.fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]
    required = {"first_name", "last_name"}
    missing = required - set(reader.fieldnames)
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing CSV columns: {missing}")

    for row in reader:
        first = row.get("first_name", "").strip()
        last = row.get("last_name", "").strip()
        if not first or not last:
            continue
        active = row.get("active", "1").strip().lower() in _TRUTHY
        existing = db.query(Teacher).filter(Teacher.first_name == first, Teacher.last_name == last).first()
        if existing:
            existing.active = active
        else:
            db.add(Teacher(first_name=first, last_name=last, active=active))
    db.commit()
    teachers = db.query(Teacher).filter(Teacher.active == True).order_by(Teacher.last_name, Teacher.first_name).all()
    return [_teacher_out(t) for t in teachers]


@router.post("/{teacher_id}/set-password", status_code=204)
def set_password(
    teacher_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    # Teachers can set their own password; admins can set any
    if current.id != teacher_id and current.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    password = body.get("password", "")
    if len(password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    teacher.password_hash = hash_password(password)
    # A self-set password stays private — not re-displayable in admin exports.
    teacher.password_seed = None
    teacher.password_enc = None
    db.commit()


@router.post("/generate-credentials", response_model=list[TeacherCredentialRow])
def generate_credentials(db: Session = Depends(get_db), _: object = Depends(require_admin_feature("teachers"))):
    """Mint a username + password for every active teacher that lacks one.
    Existing credentials are kept; only teachers without a password get a new one."""
    teachers = db.query(Teacher).filter(Teacher.active == True).order_by(
        Teacher.last_name, Teacher.first_name
    ).all()
    existing = {t.username for t in teachers if t.username}
    result: list[TeacherCredentialRow] = []
    for t in teachers:
        plain = _mint_teacher_credentials(t, existing)  # sets t.username in place
        result.append(TeacherCredentialRow(
            id=t.id, last_name=t.last_name, first_name=t.first_name,
            role=t.role, username=t.username, password=plain,
        ))
    db.commit()
    return result


# Der Sammelexport aller Lehrerzugaenge ist ersatzlos entfallen. Eine CSV mit
# den Klarpasswoertern des ganzen Kollegiums ist nichts, was sich versehentlich
# richtig verwenden laesst — sie liegt danach im Downloads-Ordner, im Mail-
# Anhang, auf dem USB-Stick. Wer ein einzelnes Passwort braucht, holt es unten
# ueber /{teacher_id}/password, einzeln und mit zweitem Faktor.


class RevealIn(BaseModel):
    # Frischer Sechsstelliger aus der Authenticator-App.
    code: str


class RevealOut(BaseModel):
    id: int
    last_name: str
    first_name: str
    username: str | None
    # None, wenn das Passwort von Hand gesetzt wurde: dann ist der Klartext
    # nirgends gespeichert und nur ein Zuruecksetzen hilft.
    password: str | None


@router.post("/{teacher_id}/password", response_model=RevealOut)
def reveal_teacher_password(
    teacher_id: int,
    body: RevealIn,
    request: Request,
    db: Session = Depends(get_db),
    current: Teacher = Depends(require_admin),
):
    """Das Passwort *einer* Lehrkraft ansehen — Admin und frischer 2FA-Code.

    Step-up bei jedem Abruf: eine uebernommene Admin-Sitzung allein reicht
    nicht, es braucht auch das Telefon. Jeder Abruf steht anschliessend im
    Protokoll, mit dem Konto, das gelesen wurde.
    """
    require_totp(db, current, body.code)
    t = db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(404, "Lehrkraft nicht gefunden")
    audit("teachers.password.reveal", current, target=t.username or str(t.id),
          detail="Einzelabruf mit 2FA", request=request, db=db)
    return RevealOut(
        id=t.id, last_name=t.last_name, first_name=t.first_name,
        username=t.username, password=_display_password(t) or None,
    )


class TeacherCreate(BaseModel):
    first_name: str
    last_name: str
    role: str = "teacher"           # auth level: "teacher" | "admin"
    email: str | None = None
    teacher_role: str | None = None  # profession name (Lehrer/SPF/…), optional


@router.post("", response_model=TeacherCredentialRow, status_code=201)
def create_teacher(body: TeacherCreate, db: Session = Depends(get_db), _: object = Depends(require_admin_feature("teachers"))):
    """Manually create a single teacher/admin account and mint its credentials."""
    first = body.first_name.strip()
    last = body.last_name.strip()
    if not first or not last:
        raise HTTPException(422, "Vor- und Nachname erforderlich")
    if body.role not in ("teacher", "admin"):
        raise HTTPException(422, "Rolle muss 'teacher' oder 'admin' sein")

    role_id = None
    if body.teacher_role:
        roles = {r.name.lower(): r for r in db.query(TeacherRole).all()}
        tr = roles.get(body.teacher_role.strip().lower())
        if not tr:
            raise HTTPException(422, f"Rolle '{body.teacher_role}' unbekannt")
        role_id = tr.id

    teacher = Teacher(
        first_name=first, last_name=last, role=body.role, active=True,
        email=(body.email or "").strip() or None, teacher_role_id=role_id,
    )
    db.add(teacher)
    db.flush()
    existing = {u for (u,) in db.query(Teacher.username).filter(Teacher.username.isnot(None)).all()}
    plain = _mint_teacher_credentials(teacher, existing)
    db.commit()
    db.refresh(teacher)
    return TeacherCredentialRow(
        id=teacher.id, last_name=teacher.last_name, first_name=teacher.first_name,
        role=teacher.role, username=teacher.username, password=plain,
    )


@router.post("/{teacher_id}/reset-password", response_model=TeacherCredentialRow)
def reset_password(teacher_id: int, db: Session = Depends(get_db), _: object = Depends(require_admin_feature("teachers"))):
    """Admin: issue a fresh random password (and username if missing) for one teacher."""
    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    existing = {u for (u,) in db.query(Teacher.username).filter(
        Teacher.username.isnot(None), Teacher.id != teacher_id
    ).all()}
    plain = _reset_teacher_password(teacher, existing)
    db.commit()
    db.refresh(teacher)
    return TeacherCredentialRow(
        id=teacher.id, last_name=teacher.last_name, first_name=teacher.first_name,
        role=teacher.role, username=teacher.username, password=plain,
    )


class UsernameUpdate(BaseModel):
    username: str


@router.delete("/{teacher_id}", status_code=204)
def delete_teacher(teacher_id: int, db: Session = Depends(get_db), actor: Teacher = Depends(require_admin_feature("teachers"))):
    """Admin: permanently delete a teacher. Blocked (409) when the teacher still
    owns RESTRICT-referenced data (created games, awarded points, …)."""
    if teacher_id == actor.id:
        raise HTTPException(400, "Sie können Ihr eigenes Konto nicht löschen.")
    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    db.delete(teacher)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Lehrkraft kann nicht gelöscht werden — es existieren noch verknüpfte Daten (z. B. erstellte Spiele oder vergebene Punkte).")


@router.patch("/{teacher_id}/username", response_model=TeacherOut)
def set_teacher_username(teacher_id: int, body: UsernameUpdate, db: Session = Depends(get_db), _: object = Depends(require_admin_feature("teachers"))):
    """Admin: change a teacher's login username (must stay unique)."""
    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    username = body.username.strip()
    if not username:
        raise HTTPException(422, "Benutzername darf nicht leer sein")
    clash = db.query(Teacher).filter(
        Teacher.username == username, Teacher.id != teacher_id
    ).first()
    if clash:
        raise HTTPException(409, "Benutzername bereits vergeben")
    teacher.username = username
    db.commit()
    db.refresh(teacher)
    return _teacher_out(teacher, _ws_lookup(db))


# ---------------------------------------------------------------------------
# Teacher management (admin): Klassenlehrer + teaching assignments
# ---------------------------------------------------------------------------

class KlasseUpdate(BaseModel):
    klasse_id: int | None = None


class AssignmentIn(BaseModel):
    subject: str
    class_id: int | None = None   # Klasse+Fach
    group_id: int | None = None   # Klasse 9/10 Kurssystem / Wahlpflicht: Kurs-Gruppe


@router.patch("/{teacher_id}/klasse", response_model=TeacherOut)
def set_klassenlehrer(
    teacher_id: int,
    body: KlasseUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("teachers")),
):
    """Set (or clear) which class this teacher is Klassenlehrer of."""
    t = db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(404, "Teacher not found")
    if body.klasse_id is not None and not db.get(Class, body.klasse_id):
        raise HTTPException(404, "Class not found")
    t.klasse_id = body.klasse_id
    db.commit()
    db.refresh(t)
    return _teacher_out(t, _ws_lookup(db))


@router.post("/{teacher_id}/assignments", response_model=TeacherOut, status_code=201)
def add_assignment(
    teacher_id: int,
    body: AssignmentIn,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("teachers")),
):
    t = db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(404, "Teacher not found")
    subject = body.subject.strip()
    if not subject:
        raise HTTPException(422, "Fach fehlt")
    if bool(body.class_id) == bool(body.group_id):
        raise HTTPException(422, "Entweder Klasse ODER Kurs/Wahlpflicht-Gruppe angeben")
    if body.class_id and not db.get(Class, body.class_id):
        raise HTTPException(404, "Class not found")
    if body.group_id:
        group = db.get(StudentGroup, body.group_id)
        if not group:
            raise HTTPException(404, "Gruppe nicht gefunden")
        if group.group_type not in ("kurs", "wahlpflicht"):
            raise HTTPException(422, "Nur Kurs- oder Wahlpflicht-Gruppen zuweisbar")

    exists = db.query(TeacherAssignment).filter_by(
        teacher_id=teacher_id, class_id=body.class_id, group_id=body.group_id, subject=subject
    ).first()
    if not exists:
        db.add(TeacherAssignment(
            teacher_id=teacher_id, subject=subject,
            class_id=body.class_id, group_id=body.group_id,
        ))
        db.commit()
    db.refresh(t)
    return _teacher_out(t, _ws_lookup(db))


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("teachers")),
):
    a = db.get(TeacherAssignment, assignment_id)
    if not a:
        raise HTTPException(404)
    db.delete(a)
    db.commit()


# ---------------------------------------------------------------------------
# Lehrerdaten — richer CSV import (number, name, email, Klasse, role) with a
# preview/apply diff, mirroring the Schülerdaten import in api/routers/students.py.
# ---------------------------------------------------------------------------

_COL_ALIASES: dict[str, str] = {
    "#": "nummer", "nummer": "nummer", "nr": "nummer", "number": "nummer",
    "nachname": "nachname", "lastname": "nachname", "last_name": "nachname", "name": "nachname",
    "vorname": "vorname", "firstname": "vorname", "first_name": "vorname", "first name": "vorname",
    "email": "email", "e-mail": "email", "mail": "email",
    "klasse": "klasse", "class": "klasse",
    "rolle": "role", "role": "role",
}


def _parse_csv(raw: bytes) -> list[dict[str, str]]:
    encoding = chardet.detect(raw)["encoding"] or "utf-8"
    text = raw.decode(encoding)
    sample = text[:4096]
    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows = []
    for row in reader:
        mapped: dict[str, str] = {}
        for key, val in row.items():
            if key is None:
                continue
            norm_key = _COL_ALIASES.get(key.strip().lower(), "")
            if norm_key:
                mapped[norm_key] = (val or "").strip()
        rows.append(mapped)
    return rows


def _teacher_to_dict(t: Teacher) -> dict[str, str]:
    return {
        "nummer": str(t.nummer) if t.nummer is not None else "",
        "nachname": t.last_name or "",
        "vorname": t.first_name or "",
        "email": t.email or "",
        "klasse": t.klasse.code if t.klasse else "",
        "role": t.teacher_role.name if t.teacher_role else "",
    }


_DIFF_FIELDS = ("nummer", "email", "klasse", "role")


@router.post("/preview", response_model=TeacherPreviewResponse)
def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("teachers")),
):
    """Parse CSV and return a diff against the current DB — no writes."""
    raw = file.file.read()
    try:
        rows = _parse_csv(raw)
    except Exception as exc:
        raise HTTPException(400, f"CSV-Parsing fehlgeschlagen: {exc}")

    all_teachers = db.query(Teacher).all()
    existing_by_nummer = {t.nummer: t for t in all_teachers if t.nummer is not None}
    existing_by_name = {(t.last_name.lower(), t.first_name.lower()): t for t in all_teachers}

    diff: list[dict] = []
    for row in rows:
        nachname = row.get("nachname", "").strip()
        vorname = row.get("vorname", "").strip()
        if not nachname or not vorname:
            continue

        nummer_raw = row.get("nummer", "").strip()
        nummer = int(nummer_raw) if nummer_raw.isdigit() else None

        key = f"{nummer}|{nachname}|{vorname}" if nummer is not None else f"{nachname}|{vorname}"
        db_teacher = existing_by_nummer.get(nummer) if nummer is not None else None
        if db_teacher is None:
            db_teacher = existing_by_name.get((nachname.lower(), vorname.lower()))

        if db_teacher is None:
            diff.append({"key": key, "action": "new", "csv_data": row, "db_data": None,
                         "changed_fields": [k for k, v in row.items() if v]})
        else:
            db_data = _teacher_to_dict(db_teacher)
            changed = [
                field for field in _DIFF_FIELDS
                if row.get(field, "").strip() and row.get(field, "").strip() != db_data.get(field, "")
            ]
            action = "update" if changed else "unchanged"
            diff.append({"key": key, "action": action, "csv_data": row, "db_data": db_data, "changed_fields": changed})

    return {
        "diff": diff,
        "summary": {
            "new": sum(1 for d in diff if d["action"] == "new"),
            "update": sum(1 for d in diff if d["action"] == "update"),
            "unchanged": sum(1 for d in diff if d["action"] == "unchanged"),
        },
    }


@router.post("/apply")
def apply_import(
    body: TeacherApplyRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("teachers")),
):
    roles_by_name = {r.name.lower(): r for r in db.query(TeacherRole).all()}
    default_role = roles_by_name.get("lehrer")

    all_teachers = db.query(Teacher).all()
    existing_by_nummer = {t.nummer: t for t in all_teachers if t.nummer is not None}
    existing_by_name = {(t.last_name.lower(), t.first_name.lower()): t for t in all_teachers}

    applied = 0
    errors: list[str] = []

    for key in body.selected_keys:
        row = body.csv_data.get(key)
        if not row:
            continue
        nachname = row.get("nachname", "").strip()
        vorname = row.get("vorname", "").strip()
        if not nachname or not vorname:
            errors.append(f"{key}: Nachname/Vorname fehlt")
            continue

        nummer_raw = row.get("nummer", "").strip()
        nummer = int(nummer_raw) if nummer_raw.isdigit() else None
        email = row.get("email", "").strip() or None
        klasse_code = row.get("klasse", "").strip()
        role_name = row.get("role", "").strip()

        klasse = None
        if klasse_code:
            klasse = db.query(Class).filter_by(code=klasse_code).first()
            if not klasse:
                errors.append(f"{nachname}, {vorname}: Klasse '{klasse_code}' nicht gefunden")

        if role_name:
            role = roles_by_name.get(role_name.lower())
            if not role:
                errors.append(f"{nachname}, {vorname}: Rolle '{role_name}' unbekannt, 'Lehrer' verwendet")
                role = default_role
        else:
            role = default_role

        teacher = existing_by_nummer.get(nummer) if nummer is not None else None
        if teacher is None:
            teacher = existing_by_name.get((nachname.lower(), vorname.lower()))
        if teacher is None:
            teacher = Teacher(first_name=vorname, last_name=nachname, active=True)
            db.add(teacher)
            db.flush()
            existing_by_name[(nachname.lower(), vorname.lower())] = teacher
            if nummer is not None:
                existing_by_nummer[nummer] = teacher

        teacher.first_name = vorname
        teacher.last_name = nachname
        if nummer is not None:
            teacher.nummer = nummer
        if email:
            teacher.email = email
        teacher.teacher_role_id = role.id if role else None
        teacher.klasse_id = klasse.id if klasse else None
        applied += 1

    db.commit()
    return {"applied": applied, "errors": errors}
