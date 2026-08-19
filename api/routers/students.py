import csv
import io
import random
import re
from datetime import date

import chardet
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Student, Class
from ..schemas import (
    StudentOut, StudentCredentialRow, StudentCredsResult, StudentPreviewResponse,
    StudentApplyRequest, StudentCardData, StudentEnrichRow, StudentCandidate,
    StudentFieldConflict, StudentAbsentRow,
)
from ..auth import hash_password, verify_password, get_current_teacher
from ..admin_access import require_admin_feature
from .classes import assert_class_editor
from ..password_gen import generate_password
from ..schoolyear import klasse_to_ak_code, get_school_year_start
from ..pw_crypto import encrypt as _pw_encrypt, encrypt_sensitive, decrypt_extra, display_password as _display_password

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
        **decrypt_extra(s.extra_fields or {}),
    }


def encrypt_seed_passwords(db: Session) -> int:
    """Migrate seed-based student passwords to encrypted-at-rest (idempotent):
    encrypt the seed-derived plaintext into password_enc and drop the seed, so a
    DB dump alone can't reconstruct them. Only rows whose seed still matches the
    stored hash are migrated — a drifted row keeps its seed for generate-
    credentials to heal. Caller commits. Returns the number migrated."""
    rows = db.query(Student).filter(Student.password_seed.isnot(None)).all()
    migrated = 0
    for s in rows:
        if not s.password_hash:
            continue
        plain = generate_password(s.password_seed)
        if not verify_password(plain, s.password_hash):
            continue
        if not s.password_enc:
            s.password_enc = _pw_encrypt(plain)
        s.password_seed = None
        migrated += 1
    return migrated


# ---------------------------------------------------------------------------
# Enrichment-mode fuzzy matching
# ---------------------------------------------------------------------------

# Known fields whose CSV value may differ from the DB and is surfaced as a
# keep-DB / keep-CSV conflict (never nachname/vorname/klasse — those are locked).
_CONFLICT_FIELDS = ("nummer", "geschlecht", "geburtsdatum")


def _name_tokens(vorname: str) -> set[str]:
    """Normalized set of given-name tokens ('Anna Maria' -> {'anna', 'maria'})."""
    return {t for t in (_normalize_name_part(p) for p in vorname.split()) if t}


def _enrich_candidates(students: list[Student], nachname: str, vorname: str,
                       klasse: str, target_ak: str | None) -> list[Student]:
    """Existing students a file row could refer to: exact normalized nachname +
    token-subset vorname (file given-names ⊆ DB given-names). The class narrows
    the set only when it doesn't empty it (a stale class never blocks a match):
    a candidate matches the class by its year-invariant AK-code (`target_ak`,
    derived from the list's school year) or by the literal klasse label."""
    nk = _normalize_name_part(nachname)
    file_tokens = _name_tokens(vorname)
    cands = [
        s for s in students
        if _normalize_name_part(s.nachname or "") == nk
        and (not file_tokens or file_tokens.issubset(_name_tokens(s.vorname or "")))
    ]
    if len(cands) > 1 and (target_ak or klasse):
        narrowed = [
            s for s in cands
            if (target_ak and s.ak_code == target_ak)
            or (klasse and (s.klasse or "").lower() == klasse.lower())
        ]
        if narrowed:
            cands = narrowed
    return cands


def _known_conflict(field: str, csv_val: str, s: Student) -> StudentFieldConflict | None:
    """A differing non-empty known field on `s`, normalized so 'm' vs 'männlich'
    or date-format differences aren't reported as conflicts. None if no conflict."""
    csv_val = csv_val.strip()
    if not csv_val:
        return None
    if field == "geschlecht":
        try:
            cv = _norm_geschlecht(csv_val)
        except ValueError:
            return None
        dv = s.geschlecht or ""
        if cv != dv:
            return StudentFieldConflict(field=field, db_val=dv, csv_val=cv)
    elif field == "geburtsdatum":
        cv = _parse_date(csv_val)
        if cv and cv != s.geburtsdatum:
            return StudentFieldConflict(
                field=field,
                db_val=s.geburtsdatum.strftime("%d.%m.%Y") if s.geburtsdatum else "",
                csv_val=cv.strftime("%d.%m.%Y"),
            )
    elif field == "nummer" and csv_val.isdigit():
        cv = int(csv_val)
        if cv != s.nummer:
            return StudentFieldConflict(
                field=field, db_val=str(s.nummer) if s.nummer is not None else "",
                csv_val=str(cv),
            )
    return None


def _candidate(s: Student) -> StudentCandidate:
    return StudentCandidate(id=s.id, nachname=s.nachname, vorname=s.vorname, klasse=s.klasse)


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
    mode: str = Form("roster"),
    list_year: int = Form(0),
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Parse CSV and return a diff against the current DB — no writes.

    mode="roster": name+klasse (AK-code fallback) upsert diff, plus the students
    in the file's classes that are *absent* from the file (deletion candidates).
    mode="enrichment": fuzzy name-match existing students and surface only the
    extra columns to add, with known-field differences flagged as conflicts.
    `list_year` is the start year of the school year the enrichment list's Klasse
    column refers to (0 = current), used to convert a stale Klasse to a stable
    AK-code for disambiguation.
    """
    raw = file.file.read()
    try:
        rows = _parse_csv_extended(raw)
    except Exception as exc:
        raise HTTPException(400, f"CSV-Parsing fehlgeschlagen: {exc}")

    if mode == "enrichment":
        return _preview_enrichment(db, rows, list_year)
    return _preview_roster(db, rows)


def _preview_roster(db: Session, rows: list[dict[str, str]]) -> dict:
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
    file_classes: set[str] = set()
    matched_ids: set[int] = set()

    for row in rows:
        nachname = row.get("nachname", "").strip()
        vorname = row.get("vorname", "").strip()
        klasse = row.get("klasse", "").strip()
        if not nachname or not klasse:
            continue
        file_classes.add(klasse.lower())

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
            matched_ids.add(db_student.id)
            db_data = _student_to_dict(db_student)
            changed: list[str] = []
            for field in _KNOWN_FIELDS - {"nachname", "vorname"}:
                csv_val = row.get(field, "").strip()
                db_val = str(db_data.get(field, "") or "")
                if csv_val and csv_val != db_val:
                    changed.append(field)
            db_extra = decrypt_extra(db_student.extra_fields or {})
            for k, v in extra.items():
                if db_extra.get(k, "") != v:
                    changed.append(k)
            action = "update" if changed else "unchanged"
            diff.append({"key": key, "action": action, "csv_data": row,
                         "db_data": db_data, "changed_fields": changed})

    # Absent = active students in one of the file's classes but not in the file.
    absent = [
        StudentAbsentRow(id=s.id, nachname=s.nachname, vorname=s.vorname, klasse=s.klasse)
        for s in all_students
        if s.active and (s.klasse or "").lower() in file_classes and s.id not in matched_ids
    ]

    return {
        "mode": "roster",
        "diff": diff,
        "absent": absent,
        "extra_columns": sorted(extra_cols),
        "summary": {
            "new": sum(1 for d in diff if d["action"] == "new"),
            "update": sum(1 for d in diff if d["action"] == "update"),
            "unchanged": sum(1 for d in diff if d["action"] == "unchanged"),
            "absent": len(absent),
        },
    }


def _detect_names_swapped(all_students: list[Student], rows: list[dict[str, str]]) -> bool:
    """Some exports label the columns 'Vorname, Nachname' but actually list the
    surname first. Detect that by asking which orientation puts more values into
    the column of known DB surnames — the labelled one or the swap."""
    db_surnames = {_normalize_name_part(s.nachname or "") for s in all_students if s.nachname}
    db_surnames.discard("")
    if not db_surnames:
        return False
    as_is = sum(1 for r in rows if _normalize_name_part(r.get("nachname", "").strip()) in db_surnames)
    swapped = sum(1 for r in rows if _normalize_name_part(r.get("vorname", "").strip()) in db_surnames)
    return swapped > as_is


def _preview_enrichment(db: Session, rows: list[dict[str, str]], list_year: int) -> dict:
    all_students = db.query(Student).all()
    extra_cols: set[str] = set()
    enrich: list[StudentEnrichRow] = []
    # A date in the list's school year, so a stale Klasse ("7a" two years ago)
    # converts to the same AK-code the student carries now ("9a").
    year_date = date(list_year, 9, 1) if list_year else None
    names_swapped = _detect_names_swapped(all_students, rows)

    for i, row in enumerate(rows):
        if names_swapped:
            row["nachname"], row["vorname"] = row.get("vorname", ""), row.get("nachname", "")
        nachname = row.get("nachname", "").strip()
        vorname = row.get("vorname", "").strip()
        klasse = row.get("klasse", "").strip()
        if not nachname:
            continue

        extra = {k: v for k, v in row.items() if k not in _KNOWN_FIELDS and v}
        extra_cols.update(extra.keys())
        # Row keys collide on name alone here, so disambiguate by row index.
        key = f"{nachname}|{vorname}|{klasse}|{i}"

        target_ak = None
        if klasse:
            try:
                target_ak = klasse_to_ak_code(klasse, today=year_date)
            except ValueError:
                target_ak = None

        cands = _enrich_candidates(all_students, nachname, vorname, klasse, target_ak)
        if len(cands) == 1:
            s = cands[0]
            db_extra = decrypt_extra(s.extra_fields or {})
            extra_writes = {k: v for k, v in extra.items() if db_extra.get(k, "") != v}
            conflicts = [
                c for c in (_known_conflict(f, row.get(f, ""), s) for f in _CONFLICT_FIELDS)
                if c is not None
            ]
            outdated = bool(klasse) and (s.klasse or "").lower() != klasse.lower()
            enrich.append(StudentEnrichRow(
                key=key, status="matched", csv_data=row, match=_candidate(s),
                extra_writes=extra_writes, conflicts=conflicts, outdated=outdated,
            ))
        elif len(cands) > 1:
            enrich.append(StudentEnrichRow(
                key=key, status="ambiguous", csv_data=row,
                candidates=[_candidate(s) for s in cands],
            ))
        else:
            enrich.append(StudentEnrichRow(key=key, status="unmatched", csv_data=row))

    return {
        "mode": "enrichment",
        "enrich": enrich,
        "extra_columns": sorted(extra_cols),
        "names_swapped": names_swapped,
        "summary": {
            "matched": sum(1 for e in enrich if e.status == "matched"),
            "ambiguous": sum(1 for e in enrich if e.status == "ambiguous"),
            "unmatched": sum(1 for e in enrich if e.status == "unmatched"),
        },
    }


@router.post("/apply")
def apply_import(
    body: StudentApplyRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Apply the reviewed diff.

    roster mode: upsert the selected rows (matched by AK-code when available, so a
    student is recognized across the "7a"->"8a" grade bump instead of duplicated —
    see api/schoolyear.py) and delete the students in `delete_ids`.
    enrichment mode: for each resolution, write only the extra columns (and the
    conflict fields listed in `take_fields`) onto the chosen student; name and
    klasse are never touched.
    """
    if body.mode == "enrichment":
        return _apply_enrichment(db, body)

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
                db_student.extra_fields = {**(db_student.extra_fields or {}), **encrypt_sensitive(extra)}
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
                extra_fields=encrypt_sensitive(extra),
            ))

        applied += 1

    deleted = 0
    if body.delete_ids:
        for sid in set(body.delete_ids):
            s = db.get(Student, sid)
            if s:
                db.delete(s)
                deleted += 1

    db.commit()
    return {"applied": applied, "deleted": deleted, "errors": errors}


def _apply_enrichment(db: Session, body: StudentApplyRequest) -> dict:
    applied = 0
    errors: list[str] = []
    for res in body.resolutions:
        s = db.get(Student, res.student_id)
        if not s:
            errors.append(f"Schüler nicht gefunden: {res.student_id}")
            continue
        row = body.csv_data.get(res.key, {})
        # Extra/unknown columns are always merged in; name & klasse are never touched.
        extra = {k: v for k, v in row.items() if k not in _KNOWN_FIELDS and v}
        if extra:
            s.extra_fields = {**(s.extra_fields or {}), **encrypt_sensitive(extra)}
        for field in res.take_fields:
            val = row.get(field, "").strip()
            if not val:
                continue
            if field == "geschlecht":
                try:
                    s.geschlecht = _norm_geschlecht(val)
                except ValueError as e:
                    errors.append(str(e))
            elif field == "geburtsdatum":
                s.geburtsdatum = _parse_date(val)
            elif field == "nummer" and val.isdigit():
                s.nummer = int(val)
        applied += 1

    db.commit()
    return {"applied": applied, "deleted": 0, "errors": errors}


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
    student.password_enc = _pw_encrypt(plain)
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


class StudentProfileUpdate(BaseModel):
    alias: str | None = None
    nta: list[int] = []


@router.patch("/{student_id}/profile", response_model=StudentOut)
def update_student_profile(
    student_id: int,
    body: StudentProfileUpdate,
    db: Session = Depends(get_db),
    teacher=Depends(get_current_teacher),
):
    """Set a student's Sitzplan alias and Nachteilsausgleich flags. Allowed for the
    student's Klassenlehrer or an admin."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    if student.class_id is None and teacher.role != "admin":
        raise HTTPException(403, "Schüler ohne Klasse — nur Admins")
    if student.class_id is not None:
        assert_class_editor(teacher, student.class_id)

    alias = (body.alias or "").strip()
    student.alias = alias or None
    student.nta = sorted({n for n in body.nta if 1 <= n <= 5})
    db.commit()
    db.refresh(student)
    out = StudentOut.model_validate(student)
    out.has_credentials = bool(student.username and student.password_hash)
    return out


class UsernameUpdate(BaseModel):
    username: str


@router.patch("/{student_id}/username", response_model=StudentOut)
def set_student_username(
    student_id: int,
    body: UsernameUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Admin: change a student's login username (must stay unique)."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    username = body.username.strip()
    if not username:
        raise HTTPException(422, "Benutzername darf nicht leer sein")
    clash = db.query(Student).filter(
        Student.username == username, Student.id != student_id
    ).first()
    if clash:
        raise HTTPException(409, "Benutzername bereits vergeben")
    student.username = username
    db.commit()
    db.refresh(student)
    out = StudentOut.model_validate(student)
    out.has_credentials = bool(student.username and student.password_hash)
    return out


@router.delete("/{student_id}", status_code=204)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Admin: permanently delete a student. All references cascade or null out
    (see the ondelete rules on students.id FKs)."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    db.delete(student)
    db.commit()


class GenerateCredsRequest(BaseModel):
    # extra_fields key to reuse as the login username / password; empty/None =
    # generate with our own rules (only filling in what's missing).
    username_field: str | None = None
    password_field: str | None = None


@router.get("/field-keys", response_model=list[str])
def student_field_keys(
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Distinct extra_fields column names across students — options for the
    'reuse as username/password' dropdowns."""
    keys: set[str] = set()
    for (ef,) in db.query(Student.extra_fields).all():
        if ef:
            keys.update(ef.keys())
    return sorted(keys)


@router.post("/generate-credentials", response_model=StudentCredsResult)
def generate_credentials(
    body: GenerateCredsRequest | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin_feature("students")),
):
    """Issue login credentials for all active students.

    username_field/password_field name an extra_fields column to REUSE (e.g. the
    imported Office credentials); an empty column value or no field falls back to
    our generated rules. Reused usernames must stay unique — a clash is skipped
    and reported. Login passwords are stored bcrypt-hashed (for verification) and
    Fernet-encrypted (for re-display); see api/pw_crypto.py."""
    body = body or GenerateCredsRequest()
    username_field = (body.username_field or "").strip()
    password_field = (body.password_field or "").strip()

    students = db.query(Student).filter(Student.active == True).order_by(
        Student.klasse, Student.nachname, Student.vorname
    ).all()

    # username -> owning student id, to detect clashes when reusing external names.
    taken: dict[str, int] = {s.username: s.id for s in students if s.username}
    result: list[StudentCredentialRow] = []
    errors: list[str] = []

    for student in students:
        extra = decrypt_extra(student.extra_fields or {})

        # --- Username ---
        desired_user = (extra.get(username_field) or "").strip() if username_field else ""
        if desired_user:
            owner = taken.get(desired_user)
            if owner is not None and owner != student.id:
                errors.append(
                    f"Benutzername „{desired_user}“ doppelt — übersprungen für "
                    f"{student.nachname}, {student.vorname}"
                )
            else:
                if student.username in taken:
                    del taken[student.username]
                student.username = desired_user
                taken[desired_user] = student.id
        elif not student.username:
            student.username = _make_username(student.vorname, student.nachname, set(taken))
            taken[student.username] = student.id

        # --- Password ---
        desired_pw = (extra.get(password_field) or "").strip() if password_field else ""
        if desired_pw:
            student.password_hash = hash_password(desired_pw)
            student.password_enc = _pw_encrypt(desired_pw)
            student.password_seed = None
            plain_pw = desired_pw
        else:
            # (Re)issue when there is no hash, or the seed-derived plaintext no
            # longer matches the hash (drift from an older generator). A row with
            # a hash but no seed is externally set — keep it.
            if not student.password_hash:
                needs_password = True
            elif student.password_seed:
                needs_password = not verify_password(
                    generate_password(student.password_seed), student.password_hash)
            else:
                needs_password = False

            if needs_password:
                seed = random.randint(1, 999_999)
                plain_pw = generate_password(seed)
                student.password_seed = seed
                student.password_hash = hash_password(plain_pw)
                student.password_enc = _pw_encrypt(plain_pw)
            else:
                plain_pw = _display_password(student)
                if not student.password_enc and plain_pw:
                    student.password_enc = _pw_encrypt(plain_pw)  # backfill legacy rows

        result.append(StudentCredentialRow(
            id=student.id,
            nachname=student.nachname,
            vorname=student.vorname,
            klasse=student.klasse,
            username=student.username or "",
            password=plain_pw,
        ))

    db.commit()
    return {"rows": result, "errors": errors}


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
        pw = _display_password(s)
        if pw:
            fields["password"] = pw
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
        writer.writerow([s.klasse, s.nachname, s.vorname, s.username or "", _display_password(s)])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),  # utf-8-sig for Excel
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="zugangsdaten.csv"'},
    )
