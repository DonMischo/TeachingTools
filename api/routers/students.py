import csv
import io
import random
import re
from datetime import date

import chardet
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Student, Class
from ..schemas import StudentOut, StudentCredentialRow, StudentPreviewResponse, StudentApplyRequest, StudentCardData
from ..auth import hash_password, require_admin, get_current_teacher
from ..password_gen import POKEMON_DE, pokemon_password

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
    _: object = Depends(require_admin),
):
    """Parse CSV and return a diff against the current DB — no writes."""
    raw = file.file.read()
    try:
        rows = _parse_csv_extended(raw)
    except Exception as exc:
        raise HTTPException(400, f"CSV-Parsing fehlgeschlagen: {exc}")

    existing: dict[tuple, Student] = {
        (s.nachname.lower(), s.vorname.lower(), s.klasse.lower()): s
        for s in db.query(Student).all()
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

        lookup = (nachname.lower(), vorname.lower(), klasse.lower())
        key = f"{nachname}|{vorname}|{klasse}"
        db_student = existing.get(lookup)

        if db_student is None:
            diff.append({"key": key, "action": "new", "csv_data": row, "db_data": None,
                         "changed_fields": [k for k, v in row.items() if v]})
        else:
            db_data = _student_to_dict(db_student)
            changed: list[str] = []
            for field in _KNOWN_FIELDS - {"nachname", "vorname", "klasse"}:
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
    _: object = Depends(require_admin),
):
    """Apply selected diff rows — upserts only, never deletes existing students."""
    existing: dict[tuple, Student] = {
        (s.nachname.lower(), s.vorname.lower(), s.klasse.lower()): s
        for s in db.query(Student).all()
    }
    class_map: dict[str, int] = {c.code: c.id for c in db.query(Class).all()}

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

        lookup = (nachname.lower(), vorname.lower(), klasse.lower())
        extra = {k: v for k, v in row.items() if k not in _KNOWN_FIELDS and v}

        db_student = existing.get(lookup)
        if db_student:
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
                class_id=class_map.get(klasse),
                jahrgang=_extract_jahrgang(klasse),
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
    _: object = Depends(require_admin),
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


@router.post("/generate-credentials", response_model=list[StudentCredentialRow])
def generate_credentials(
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    students = db.query(Student).filter(Student.active == True).order_by(
        Student.klasse, Student.nachname, Student.vorname
    ).all()

    existing_usernames: set[str] = {s.username for s in students if s.username}
    result: list[StudentCredentialRow] = []

    for student in students:
        if not student.username or not student.password_hash:
            # Assign fresh Pokémon + username
            pokedex = random.randint(1, len(POKEMON_DE) - 1)
            username = _make_username(student.vorname, student.nachname, existing_usernames)
            existing_usernames.add(username)
            plain_pw = pokemon_password(pokedex)

            student.username = username
            student.pokedex_number = pokedex
            student.password_hash = hash_password(plain_pw)
        else:
            # Regenerate plaintext from stored Pokédex number (deterministic)
            plain_pw = pokemon_password(student.pokedex_number) if student.pokedex_number else "???"

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
    _: object = Depends(require_admin),
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
        if s.pokedex_number:
            fields["password"] = pokemon_password(s.pokedex_number)
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
    _: object = Depends(require_admin),
):
    students = db.query(Student).filter(
        Student.active == True, Student.username.isnot(None)
    ).order_by(Student.klasse, Student.nachname).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Klasse", "Nachname", "Vorname", "Benutzername", "Passwort"])
    for s in students:
        pw = pokemon_password(s.pokedex_number) if s.pokedex_number else ""
        writer.writerow([s.klasse, s.nachname, s.vorname, s.username or "", pw])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),  # utf-8-sig for Excel
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="zugangsdaten.csv"'},
    )
