from datetime import datetime, date
from pydantic import BaseModel


class TeacherAssignmentOut(BaseModel):
    id: int
    subject: str
    # Exactly one of the two targets is set:
    class_id: int | None = None      # normal Klasse+Fach assignment
    class_code: str | None = None
    group_id: int | None = None      # Kurs/Wahlpflicht group (Kurssystem Kl. 9/10)
    group_name: str | None = None
    group_type: str | None = None    # "kurs" | "wahlpflicht"
    label: str                       # display, e.g. "7a · Ma" or "Ma I"

    model_config = {"from_attributes": True}


class TeacherOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    active: bool
    role: str
    username: str | None = None
    nummer: int | None = None
    email: str | None = None
    teacher_role: str | None = None  # e.g. "Lehrer" / "SPF" — professional role, not auth level
    klasse: str | None = None  # set => Klassenlehrer of this class
    klasse_id: int | None = None
    assignments: list[TeacherAssignmentOut] = []
    korrektur: int = 0
    notiz: str | None = None
    av_stunden: int | None = None  # Stunden nach Arbeitsvertrag (AvSt), null = not set
    total_ws: float = 0  # sum of assignment hours (via Wochenstunden table) + korrektur

    model_config = {"from_attributes": True}


class TeacherCredentialRow(BaseModel):
    id: int
    last_name: str
    first_name: str
    role: str  # auth level: "teacher" | "admin"
    username: str
    # None when the teacher already had a manually-set (non-generated) password,
    # whose plaintext we can't recover.
    password: str | None = None


class WochenstundenOut(BaseModel):
    subject: str
    grade: int
    hours: int

    model_config = {"from_attributes": True}


class WochenstundenSet(BaseModel):
    subject: str
    grade: int
    hours: int


class TeacherKorrekturIn(BaseModel):
    korrektur: int = 0
    notiz: str | None = None
    # AvSt (Stunden nach Arbeitsvertrag): omit to leave unchanged, set
    # clear_av_stunden=true to unset.
    av_stunden: int | None = None
    clear_av_stunden: bool = False


# ---------------------------------------------------------------------------
# Calendar
# ---------------------------------------------------------------------------

class CalendarEntryIn(BaseModel):
    title: str
    description: str | None = None
    category: str  # single-select audience tier: Kollegium/Primar/Sekundar/Schulgemeinschaft/Ferien
    start_date: date
    end_date: date
    all_day: bool = True
    start_time: str | None = None  # "HH:MM", ignored if all_day
    end_time: str | None = None
    tags: list[str] = []  # free-form, colorable descriptive labels


class CalendarEntryOut(BaseModel):
    id: int
    title: str
    description: str | None
    category: str
    start_date: date
    end_date: date
    all_day: bool
    start_time: str | None
    end_time: str | None
    tags: list[str]
    created_by: int
    creator_name: str

    model_config = {"from_attributes": True}


class CalendarTagIn(BaseModel):
    name: str
    color: str


class CalendarTagOut(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class SchoolSettingsOut(BaseModel):
    bundesland: str

    model_config = {"from_attributes": True}


class SchoolSettingsIn(BaseModel):
    bundesland: str


class TeacherDiffRow(BaseModel):
    key: str
    action: str  # "new" | "update" | "unchanged"
    csv_data: dict[str, str]
    db_data: dict[str, str] | None
    changed_fields: list[str]


class TeacherPreviewResponse(BaseModel):
    diff: list[TeacherDiffRow]
    summary: dict[str, int]


class TeacherApplyRequest(BaseModel):
    selected_keys: list[str]
    csv_data: dict[str, dict[str, str]]


class ClassOut(BaseModel):
    id: int
    code: str
    display_name: str
    class_name: str | None = None
    symbol_emoji: str | None
    symbol_image: str | None
    ak_code: str | None = None
    total_points: int = 0
    ksprecher_can_edit: bool = False

    model_config = {"from_attributes": True}


class ClassSymbolUpdate(BaseModel):
    symbol_emoji: str | None = None


class ClassNameUpdate(BaseModel):
    class_name: str | None = None


class TransactionCreate(BaseModel):
    teacher_id: int
    class_id: int
    points: int
    reason: str = ""


class TransactionOut(BaseModel):
    id: int
    ts: datetime
    points: int
    reason: str | None
    class_code: str
    teacher_name: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Quiz schemas
# ---------------------------------------------------------------------------

class QuizAnswerOut(BaseModel):
    id: int
    order: int
    text: str
    correct: bool | None  # hidden from students at runtime; exposed for teacher/host

    model_config = {"from_attributes": True}


class QuizQuestionOut(BaseModel):
    id: int
    order: int
    type: str
    question_text: str
    image_path: str | None
    time_limit: int | None
    answers: list[QuizAnswerOut]
    # type "timeline": full TimelineGameSpec incl. solutions — teacher-only
    # endpoints; students get the sanitized board over the WS instead.
    content: dict | None = None

    model_config = {"from_attributes": True}


class QuizOut(BaseModel):
    id: int
    title: str
    description: str | None
    max_points: int
    time_limit_default: int
    preview_time_default: int = 3
    randomize_answers: bool
    created_at: datetime
    question_count: int = 0
    warning: str | None = None
    quiz_type: str = "classic"
    tags: list[str] = []
    grades: list[int] = []

    model_config = {"from_attributes": True}


class QuizDetailOut(QuizOut):
    questions: list[QuizQuestionOut]


class SessionCreate(BaseModel):
    # Genau eines von beidem: eine Klasse oder ein Kurs/WPF (klassenübergreifend).
    class_id: int | None = None
    group_id: int | None = None
    max_points: int = 100
    team_mode: bool = False


class ParticipantJoin(BaseModel):
    name: str
    avatar: str = "cat"
    team_id: int | None = None
    # Nur in einer Kurs/WPF-Sitzung und nur von Gästen gefüllt: angemeldete
    # Schüler bringen ihre Klasse selbst mit.
    class_id: int | None = None


class SessionOut(BaseModel):
    id: int
    join_code: str
    status: str
    current_question_idx: int
    quiz_id: int
    class_id: int | None
    group_id: int | None = None
    scope_label: str = ""
    points_awarded: int | None
    participant_count: int = 0
    team_mode: bool = False

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    teacher: TeacherOut


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

class StudentOut(BaseModel):
    """Ein Schueler, wie ihn *dieser* Aufrufer sehen darf.

    Nie mit ``model_validate`` direkt bauen — ``display_names.student_out()``
    benutzen. Der Serializer entscheidet, ob ``vorname``/``nachname`` den
    echten Namen tragen oder die Kurzform, und ob ein Geburtsdatum ueberhaupt
    mitkommt.
    """
    id: int
    nummer: int | None
    # Ausgeschrieben nur fuer Klassenleitung, Schuelerdatenverwaltung und den
    # Schueler selbst; sonst steht hier schon die Kurzform (»Anna« / »B.«).
    nachname: str
    vorname: str
    # Was angezeigt werden darf, egal wer fragt: »Anna B.«. Alles, was auch nur
    # neben anderen Leuten auf einem Bildschirm landen kann, rendert dieses Feld.
    display_name: str = ""
    klasse: str
    class_id: int | None
    jahrgang: int | None
    ak_code: str | None = None
    geschlecht: str | None = None
    # Nur fuer die Klassenleitung, und nur im Fenster von ±5 Tagen um den Tag
    # herum — sonst immer None. Gesetzt heisst also: Geburtstag steht an.
    geburtsdatum: date | None
    username: str | None
    active: bool
    alias: str | None = None
    nta: list[int] = []
    has_credentials: bool = False

    model_config = {"from_attributes": True}


class StudentCredentialRow(BaseModel):
    id: int
    nachname: str
    vorname: str
    klasse: str
    username: str
    password: str


class StudentCredsResult(BaseModel):
    rows: list[StudentCredentialRow]
    errors: list[str] = []


class StudentDiffRow(BaseModel):
    key: str
    action: str  # "new" | "update" | "unchanged"
    csv_data: dict[str, str]
    db_data: dict[str, str] | None
    changed_fields: list[str]


class StudentAbsentRow(BaseModel):
    """Roster mode: an active student in one of the classes present in the file
    who is *not* in the file — a deletion candidate (default unchecked)."""
    id: int
    nachname: str
    vorname: str
    klasse: str


class StudentCandidate(BaseModel):
    """Enrichment mode: an existing student a file row could refer to."""
    id: int
    nachname: str
    vorname: str
    klasse: str


class StudentFieldConflict(BaseModel):
    """Enrichment mode: a known field whose CSV value differs from the DB.
    Surfaced for a keep-DB / keep-CSV choice. Never covers nachname/vorname/klasse."""
    field: str
    db_val: str
    csv_val: str


class StudentEnrichRow(BaseModel):
    key: str
    status: str  # "matched" | "ambiguous" | "unmatched"
    csv_data: dict[str, str]
    match: StudentCandidate | None = None       # the single match (status == "matched")
    candidates: list[StudentCandidate] = []     # options (status == "ambiguous")
    extra_writes: dict[str, str] = {}           # new/changed extra columns to write
    conflicts: list[StudentFieldConflict] = []  # differing known fields (keep-DB/CSV)
    outdated: bool = False                       # list's Klasse differs from the student's current one


class StudentPreviewResponse(BaseModel):
    mode: str = "roster"
    diff: list[StudentDiffRow] = []             # roster
    absent: list[StudentAbsentRow] = []         # roster: not-in-list students
    enrich: list[StudentEnrichRow] = []         # enrichment
    extra_columns: list[str] = []
    names_swapped: bool = False                  # enrichment: Vorname/Nachname columns auto-swapped
    summary: dict[str, int]


class StudentResolution(BaseModel):
    """Enrichment apply: one file row resolved to a target student, with the set
    of conflict fields to overwrite from the CSV (all others keep the DB value)."""
    key: str
    student_id: int
    take_fields: list[str] = []


class StudentApplyRequest(BaseModel):
    mode: str = "roster"
    # roster:
    selected_keys: list[str] = []
    csv_data: dict[str, dict[str, str]] = {}
    delete_ids: list[int] = []                  # absent students to delete
    # enrichment:
    resolutions: list[StudentResolution] = []


class StudentCardData(BaseModel):
    id: int
    nachname: str
    vorname: str
    klasse: str
    username: str | None
    fields: dict[str, str]  # all non-empty fields incl. extra_fields


# ---------------------------------------------------------------------------
# Auth /me
# ---------------------------------------------------------------------------

class MeOut(BaseModel):
    user_type: str  # "teacher" | "student"
    teacher: TeacherOut | None = None
    student: StudentOut | None = None


# ---------------------------------------------------------------------------
# Sportfest
# ---------------------------------------------------------------------------

class SportfestDisciplineOut(BaseModel):
    id: str
    name: str
    enabled: bool

    model_config = {"from_attributes": True}


class SportfestResultUpsert(BaseModel):
    value_raw: str  # "195.4" or "3:15.4"


class SportfestResultOut(BaseModel):
    student_id: int
    discipline_id: str
    value: float | None
    points: int | None

    model_config = {"from_attributes": True}


class AuswertungStudent(BaseModel):
    rank: int
    name: str | None  # None when anonymised
    klasse: str
    jahrgang: int | None
    total_points: int


class AuswertungDisciplineEntry(BaseModel):
    rank: int          # Platz innerhalb von Disziplin *und* Geschlecht (1-3)
    name: str | None
    klasse: str
    geschlecht: str | None = None
    discipline_id: str
    value: float | None
    points: int | None


# ---------------------------------------------------------------------------
# Slideshow
# ---------------------------------------------------------------------------

class SlideshowEventOut(BaseModel):
    title: str
    start_date: date
    end_date: date
    all_day: bool
    start_time: str | None
    end_time: str | None
    tags: list[str]
    category: str


class SlideshowWochenspruchOut(BaseModel):
    sunday: str
    season: str | None
    date_label: str | None
    text: str
    reference: str | None
    psalm: str | None
    color: str | None
    color_name: str | None
    background_url: str | None
    image_credit: str | None
    hymns: list[str]
    source_url: str | None


class SlideshowItemOut(BaseModel):
    id: int
    position: int
    kind: str
    title: str
    active: bool
    audience: str
    duration_seconds: int
    media_type: str | None
    file_url: str | None
    original_filename: str | None
    url: str | None
    calendar_tags: list[str]
    calendar_categories: list[str]
    calendar_days_ahead: int
    slot_days: list[int]
    slot_start: str | None
    slot_end: str | None
    slot_from: date | None
    slot_until: date | None
    warnings: list[str] = []
    events: list[SlideshowEventOut] = []
    wochenspruch: SlideshowWochenspruchOut | None = None


class SlideshowItemIn(BaseModel):
    kind: str
    title: str | None = None
    url: str | None = None


class SlideshowItemPatch(BaseModel):
    title: str | None = None
    active: bool | None = None
    audience: str | None = None
    duration_seconds: int | None = None
    url: str | None = None
    calendar_tags: list[str] | None = None
    calendar_categories: list[str] | None = None
    calendar_days_ahead: int | None = None
    slot_days: list[int] | None = None
    slot_start: str | None = None
    slot_end: str | None = None
    slot_from: date | None = None
    slot_until: date | None = None


class SlideshowBulkPatchIn(BaseModel):
    ids: list[int]
    patch: SlideshowItemPatch


class SlideshowOrderIn(BaseModel):
    ids: list[int]


class SlideshowDeleteIn(BaseModel):
    ids: list[int]
