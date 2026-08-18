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
    class_id: int
    max_points: int = 100
    team_mode: bool = False


class ParticipantJoin(BaseModel):
    name: str
    avatar: str = "cat"
    team_id: int | None = None


class SessionOut(BaseModel):
    id: int
    join_code: str
    status: str
    current_question_idx: int
    quiz_id: int
    class_id: int
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
    id: int
    nummer: int | None
    nachname: str
    vorname: str
    klasse: str
    class_id: int | None
    jahrgang: int | None
    ak_code: str | None = None
    geschlecht: str
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


class StudentDiffRow(BaseModel):
    key: str
    action: str  # "new" | "update" | "unchanged"
    csv_data: dict[str, str]
    db_data: dict[str, str] | None
    changed_fields: list[str]


class StudentPreviewResponse(BaseModel):
    diff: list[StudentDiffRow]
    extra_columns: list[str]
    summary: dict[str, int]


class StudentApplyRequest(BaseModel):
    selected_keys: list[str]
    csv_data: dict[str, dict[str, str]]


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
    rank: int
    name: str | None
    klasse: str
    discipline_id: str
    value: float | None
    points: int | None
