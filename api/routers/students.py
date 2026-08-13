import csv
import io
import random
import re
from datetime import date

import chardet
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Student, Class
from ..schemas import StudentOut, StudentCredentialRow, StudentPreviewResponse, StudentApplyRequest, StudentCardData
from ..auth import hash_password, verify_password, get_current_teacher
from ..admin_access import require_admin_feature
from ..password_gen import generate_password
from ..schoolyear import klasse_to_ak_code

router = APIRouter(prefix="/api/students", tags=["students"])

# ---------------------------------------------------------------------------
# CSV parsing helpers
# ---------------------------------------------------------------------------

_COL_ALIASES: dict[str, str] = {
    "#": "nummer", "nummer": "nummer", "nr": "nummer",
    "nachname": "nachname", "name": "nachname",
    "vorname": "vorname",
    "klasse": "klasse", "class": "klasse",
    "geschlecht": "geschlecht", "sex": "geschlecht", "gender": "geschlecht",
    "geburtsdatum": "geburtsdatum", "birthday": "geburtsdatum",
    "geburtstag": "geburtsdatum", "dob": "geburtsdatum",
}

_MALE = {"m", "männlich", "maennlich", "male", "junge"}
_FEMALE = {"w", "weiblich", "female", "mädchen", "maedchen", "f"}


def _norm_geschlecht(s: str) -> str:
    v = s.strip().lower()
    if v in _MALE:
        return "männlich"
    if v in _FEMALE:
        return "weiblich"
    raise ValueError(f"Unbekanntes Geschlecht: {s!r}")


def _parse_date(s: str) -> date | None:
    s = s.strip()
    if not s:
        return None
    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", s)
    if m:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def _extract_jahrgang(klasse: str) -> int | None:
    digits = "".join(c for c in klasse if c.isdigit())
    return int(digits) if digits else None


def _derive_ak_code(klasse: str) -> str | None:
    """Stable Abschlussklasse identity for `klasse` (e.g. '7a' -> 'AK2029a'), or
    None if `klasse` doesn't match the expected grade+letter format."""
    try:
        return klasse_to_ak_code(klasse)
    except ValueError:
        return None


def _resolve_class(db: Session, klasse: str, ak_code: str | None) -> Class | None:
    """Find (or roll forward) the Class row for `klasse`, using `ak_code` as the
    stable identity across the yearly grade bump ('7a' -> '8a'). Falls back to an
    exact code match for classes that haven't been backfilled with an ak_code yet."""
    cls = None
    if ak_code:
        cls = db.query(Class).filter(Class.ak_code == ak_code).one_or_none()
    if cls is None:
        cls = db.query(Class).filter(Class.code == klasse).one_or_none()
    if cls is None:
        return None
    if ak_code and cls.ak_code != ak_code:
        cls.ak_code = ak_code
    if cls.code != klasse:
        cls.code = klasse
        cls.display_name = f"Klasse {klasse}"
    return cls


def _parse_csv(raw: bytes) -> list[dict]:
    encoding = chardet.detect(raw)["encoding"] or "utf-8"
    text = raw.decode(encoding)
    sample = text[:4096]
    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows = []
    for i, row in enumerate(reader, start=2):
        mapped: dict[str, str] = {}
        for key, val in row.items():
            if key is None:
                continue
            norm_key = _COL_ALIASES.get(key.strip().lower(), "")
            if norm_key:
                mapped[norm_key] = (val or "").strip()
        rows.append(mapped)
    return rows


_KNOWN_FIELDS = {"nummer", "nachname", "vorname", "klasse", "geschlecht", "geburtsdatum"}


def _parse_csv_extended(raw: bytes) -> list[dict[str, str]]:
    """Like _parse_csv but keeps unknown columns with their original header name."""
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
            k = key.strip()
            canonical = _COL_ALIASES.get(k.lower(), "")
            if canonical:
                mapped[canonical] = (val or "").strip()
            elif k:
                mapped[k] = (val or "").strip()
        rows.append(mapped)
    return rows


def _student_to_dict(s: Student) -> dict[str, str]:
    return {
        "nummer": str(s.nummer) if s.nummer is not None else "",
        "nachname": s.nachname or "",
        "vorname": s.vorname or "",
        "klasse": s.klasse or "",
        "geschlecht": s.geschlecht or "",
        "geburtsdatum": s.geburtsdatum.strftime("%d.%m.%Y") if s.geburtsdatum else "",
        **(s.extra_fields or {}),
    }


# ---------------------------------------------------------------------------
# Username generation
# ---------------------------------------------------------------------------

_UMLAUT = str.maketrans({"ä": "a", "ö": "o", "ü": "u", "Ä": "a", "Ö": "o", "Ü": "u", "ß": "ss"})


def _normalize_name_part(s: str) -> str:
    s = s.lower().translate(_UMLAUT)
    return re.sub(r"[^a-z0-9]", "", s)


def _make_username(vorname: str, nachname: str, existing: set[str]) -> str:
    initial = _normalize_name_part(vorname)[:1] or "x"
    last = _normalize_name_part(nachname) or "student"
    base = f"{initial}.{last}"
    for _ in range(200):
        suffix = random.randint(10, 99)
        username = f"{base}{suffix}"
        if username not in existing:
            return username
    raise RuntimeError(f"Cannot generate unique username for {vorname} {nachname}")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/preview", response_model=StudentPreviewResponse)
def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Parse CSV and return a diff against the current DB — no writes."""
    raw = file.file.read()
    try:
        rows = _parse_csv_extended(raw)
    except Exception as exc:
        raise HTTPException(400, f"CSV-Parsing fehlgeschlagen: {exc}")

    all_students = db.query(Student).all()
    existing: dict[tuple, Student] = {
        (s.nachname.lower(), s.vorname.lower(), s.klasse.lower()): s
        for s in all_students
    }
    # Stable match across the yearly grade bump ("7a" -> "8a"): keyed by name + AK-code
    # instead of name + current klasse label. Only populated once a student has been
    # imported at least once since the ak_code column was introduced.
    existing_by_ak: dict[tuple, Student] = {
        (s.nachname.lower(), s.vorname.lower(), s.ak_code): s
        for s in all_students if s.ak_code
    }

    extra_cols: set[str] = set()
    diff: list[dict] = []

    for row in rows:
        nachname = row.get("nachname", "").strip()
        vorname = row.get("vorname", "").strip()
        klasse = row.get("klasse", "").strip()
        if not nachname or not klasse:
            continue

        extra = {k: v for k, v in row.items() if k not in _KNOWN_FIELDS and v}
        extra_cols.update(extra.keys())

        ak_code = _derive_ak_code(klasse)
        key = f"{nachname}|{vorname}|{klasse}"
        db_student = None
        if ak_code:
            db_student = existing_by_ak.get((nachname.lower(), vorname.lower(), ak_code))
        if db_student is None:
            db_student = existing.get((nachname.lower(), vorname.lower(), klasse.lower()))

        if db_student is None:
            diff.append({"key": key, "action": "new", "csv_data": row, "db_data": None,
                         "changed_fields": [k for k, v in row.items() if v]})
        else:
            db_data = _student_to_dict(db_student)
            changed: list[str] = []
            for field in _KNOWN_FIELDS - {"nachname", "vorname"}:
                csv_val = row.get(field, "").strip()
                db_val = str(db_data.get(field, "") or "")
                if csv_val and csv_val != db_val:
                    changed.append(field)
            db_extra = db_student.extra_fields or {}
            for k, v in extra.items():
                if db_extra.get(k, "") != v:
                    changed.append(k)
            action = "update" if changed else "unchanged"
            diff.append({"key": key, "action": action, "csv_data": row,
                         "db_data": db_data, "changed_fields": changed})

    return {
        "diff": diff,
        "extra_columns": sorted(extra_cols),
        "summary": {
            "new": sum(1 for d in diff if d["action"] == "new"),
            "update": sum(1 for d in diff if d["action"] == "update"),
            "unchanged": sum(1 for d in diff if d["action"] == "unchanged"),
        },
    }


@router.post("/apply")
def apply_import(
    body: StudentApplyRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Apply selected diff rows — upserts only, never deletes existing students.

    Students and classes are matched by AK-code (stable Abschlussklasse identity)
    when available, so a class/student is recognized across the yearly grade bump
    ("7a" -> "8a") instead of being duplicated. See api/schoolyear.py.
    """
    all_students = db.query(Student).all()
    existing: dict[tuple, Student] = {
        (s.nachname.lower(), s.vorname.lower(), s.klasse.lower()): s
        for s in all_students
    }
    existing_by_ak: dict[tuple, Student] = {
        (s.nachname.lower(), s.vorname.lower(), s.ak_code): s
        for s in all_students if s.ak_code
    }

    applied = 0
    errors: list[str] = []

    for key in body.selected_keys:
        row = body.csv_data.get(key)
        if not row:
            errors.append(f"Keine Daten für Schlüssel: {key}")
            continue

        nachname = row.get("nachname", "").strip()
        vorname = row.get("vorname", "").strip()
        klasse = row.get("klasse", "").strip()
        if not nachname or not klasse:
            errors.append(f"Pflichtfelder fehlen: {key}")
            continue

        ak_code = _derive_ak_code(klasse)
        extra = {k: v for k, v in row.items() if k not in _KNOWN_FIELDS and v}
        cls = _resolve_class(db, klasse, ak_code)

        db_student = None
        if ak_code:
            db_student = existing_by_ak.get((nachname.lower(), vorname.lower(), ak_code))
        if db_student is None:
            db_student = existing.get((nachname.lower(), vorname.lower(), klasse.lower()))

        if db_student:
            db_student.klasse = klasse
            db_student.class_id = cls.id if cls else db_student.class_id
            db_student.jahrgang = _extract_jahrgang(klasse)
            if ak_code:
                db_student.ak_code = ak_code
            if row.get("nummer") and row["nummer"].isdigit():
                db_student.nummer = int(row["nummer"])
            if row.get("geschlecht"):
                try:
                    db_student.geschlecht = _norm_geschlecht(row["geschlecht"])
                except ValueError:
                    pass
            if row.get("geburtsdatum"):
                db_student.geburtsdatum = _parse_date(row["geburtsdatum"])
            if extra:
                db_student.extra_fields = {**(db_student.extra_fields or {}), **extra}
        else:
            geschlecht = None
            if row.get("geschlecht"):
                try:
                    geschlecht = _norm_geschlecht(row["geschlecht"])
                except ValueError as e:
                    errors.append(str(e))
            nummer_raw = row.get("nummer", "")
            db.add(Student(
                nummer=int(nummer_raw) if nummer_raw.isdigit() else None,
                nachname=nachname,
                vorname=vorname,
                klasse=klasse,
                class_id=cls.id if cls else None,
                jahrgang=_extract_jahrgang(klasse),
                ak_code=ak_code,
                geschlecht=geschlecht,
                geburtsdatum=_parse_date(row.get("geburtsdatum", "")),
                extra_fields=extra or {},
            ))

        applied += 1

    db.commit()
    return {"applied": applied, "errors": errors}


@router.post("/import", status_code=201)
def import_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    raw = file.file.read()
    try:
        rows = _parse_csv(raw)
    except Exception as exc:
        raise HTTPException(400, f"CSV-Parsing fehlgeschlagen: {exc}")

    # Delete all existing students (replaces entire list)
    db.query(Student).delete()
    db.flush()

    # Build a map of class code → id for FK linking
    class_map: dict[str, int] = {
        c.code: c.id for c in db.query(Class).all()
    }

    errors: list[str] = []
    added = 0
    for i, row in enumerate(rows, start=2):
        nachname = row.get("nachname", "").strip()
        klasse = row.get("klasse", "").strip()
        geschlecht_raw = row.get("geschlecht", "").strip()

        if not nachname or not klasse or not geschlecht_raw:
            errors.append(f"Zeile {i}: Pflichtfelder fehlen (Nachname/Klasse/Geschlecht)")
            continue

        try:
            geschlecht = _norm_geschlecht(geschlecht_raw)
        except ValueError as e:
            errors.append(f"Zeile {i}: {e}")
            continue

        nummer_raw = row.get("nummer", "")
        nummer = int(nummer_raw) if nummer_raw.isdigit() else None

        db.add(Student(
            nummer=nummer,
            nachname=nachname,
            vorname=row.get("vorname", ""),
            klasse=klasse,
            class_id=class_map.get(klasse),
            jahrgang=_extract_jahrgang(klasse),
            geschlecht=geschlecht,
            geburtsdatum=_parse_date(row.get("geburtsdatum", "")),
        ))
        added += 1

    db.commit()
    result: dict = {"imported": added}
    if errors:
        result["errors"] = errors
    return result


@router.get("", response_model=list[StudentOut])
def list_students(
    klasse: str | None = None,
    jahrgang: int | None = None,
    geschlecht: str | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_teacher),
):
    q = db.query(Student)
    if klasse:
        q = q.filter(Student.klasse == klasse)
    if jahrgang is not None:
        q = q.filter(Student.jahrgang == jahrgang)
    if geschlecht:
        q = q.filter(Student.geschlecht == geschlecht)
    students = q.order_by(Student.klasse, Student.nachname, Student.vorname).all()
    result = []
    for s in students:
        out = StudentOut.model_validate(s)
        out.has_credentials = bool(s.username and s.password_hash)
        result.append(out)
    return result


def _new_student_password(student: Student) -> str:
    """Assign a fresh random password to the student; returns the plaintext."""
    seed = random.randint(1, 999_999)
    plain = generate_password(seed)
    student.password_seed = seed
    student.password_hash = hash_password(plain)
    return plain


class StudentCreate(BaseModel):
    vorname: str
    nachname: str
    klasse: str
    geschlecht: str


@router.post("", response_model=StudentCredentialRow, status_code=201)
def create_student(
    body: StudentCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Manually create a single student and mint username + password."""
    vorname = body.vorname.strip()
    nachname = body.nachname.strip()
    klasse = body.klasse.strip()
    if not nachname or not klasse:
        raise HTTPException(422, "Nachname und Klasse erforderlich")
    try:
        geschlecht = _norm_geschlecht(body.geschlecht)
    except ValueError as e:
        raise HTTPException(422, str(e))

    ak_code = _derive_ak_code(klasse)
    cls = _resolve_class(db, klasse, ak_code)

    existing = {u for (u,) in db.query(Student.username).filter(Student.username.isnot(None)).all()}
    student = Student(
        nachname=nachname, vorname=vorname, klasse=klasse,
        class_id=cls.id if cls else None, jahrgang=_extract_jahrgang(klasse),
        ak_code=ak_code, geschlecht=geschlecht,
        username=_make_username(vorname, nachname, existing),
    )
    plain = _new_student_password(student)
    db.add(student)
    db.commit()
    db.refresh(student)
    return StudentCredentialRow(
        id=student.id, nachname=student.nachname, vorname=student.vorname,
        klasse=student.klasse, username=student.username, password=plain,
    )


@router.post("/{student_id}/reset-password", response_model=StudentCredentialRow)
def reset_student_password(
    student_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Admin: issue a fresh random password (and username if missing) for one student."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    if not student.username:
        existing = {u for (u,) in db.query(Student.username).filter(
            Student.username.isnot(None), Student.id != student_id
        ).all()}
        student.username = _make_username(student.vorname, student.nachname, existing)
    plain = _new_student_password(student)
    db.commit()
    db.refresh(student)
    return StudentCredentialRow(
        id=student.id, nachname=student.nachname, vorname=student.vorname,
        klasse=student.klasse, username=student.username, password=plain,
    )


@router.post("/generate-credentials", response_model=list[StudentCredentialRow])
def generate_credentials(
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    students = db.query(Student).filter(Student.active == True).order_by(
        Student.klasse, Student.nachname, Student.vorname
    ).all()

    existing_usernames: set[str] = {s.username for s in students if s.username}
    result: list[StudentCredentialRow] = []

    for student in students:
        # A password needs (re)issuing when there is none yet — or when the
        # seed-derived plaintext no longer matches the stored hash. The latter
        # happens when credentials were created by an older password-generator
        # implementation: the endpoint would then DISPLAY a password that
        # doesn't actually log in. Re-hashing here heals such drift.
        needs_password = (
            not student.password_hash
            or not student.password_seed
            or not verify_password(generate_password(student.password_seed), student.password_hash)
        )
        if not student.username:
            student.username = _make_username(student.vorname, student.nachname, existing_usernames)
            existing_usernames.add(student.username)
        if needs_password:
            # generate_password() is deterministic per seed, so storing the
            # seed lets us re-display the plaintext later (CSV export, cards).
            seed = random.randint(1, 999_999)
            plain_pw = generate_password(seed)
            student.password_seed = seed
            student.password_hash = hash_password(plain_pw)
        else:
            plain_pw = generate_password(student.password_seed)

        result.append(StudentCredentialRow(
            id=student.id,
            nachname=student.nachname,
            vorname=student.vorname,
            klasse=student.klasse,
            username=student.username,
            password=plain_pw,
        ))

    db.commit()
    return result


@router.get("/card-data", response_model=list[StudentCardData])
def student_card_data(
    klasse: str | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """All student fields (incl. extra_fields) for card generation."""
    q = db.query(Student).filter(Student.active == True)
    if klasse:
        q = q.filter(Student.klasse == klasse)
    students = q.order_by(Student.klasse, Student.nachname, Student.vorname).all()
    result = []
    for s in students:
        base = _student_to_dict(s)
        fields = {k: v for k, v in base.items() if v and k not in ("nachname", "vorname", "klasse")}
        if s.username:
            fields["username"] = s.username
        if s.password_seed:
            fields["password"] = generate_password(s.password_seed)
        result.append(StudentCardData(
            id=s.id,
            nachname=s.nachname,
            vorname=s.vorname,
            klasse=s.klasse,
            username=s.username,
            fields=fields,
        ))
    return result


@router.get("/credentials/download")
def download_credentials(
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    students = db.query(Student).filter(
        Student.active == True, Student.username.isnot(None)
    ).order_by(Student.klasse, Student.nachname).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Klasse", "Nachname", "Vorname", "Benutzername", "Passwort"])
    for s in students:
        pw = generate_password(s.password_seed) if s.password_seed else ""
        writer.writerow([s.klasse, s.nachname, s.vorname, s.username or "", pw])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),  # utf-8-sig for Excel
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="zugangsdaten.csv"'},
    )
