from datetime import datetime, date
from pydantic import BaseModel


class TeacherOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    active: bool
    role: str

    model_config = {"from_attributes": True}


class ClassOut(BaseModel):
    id: int
    code: str
    display_name: str
    class_name: str | None = None
    symbol_emoji: str | None
    symbol_image: str | None
    total_points: int = 0

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

    model_config = {"from_attributes": True}


class QuizOut(BaseModel):
    id: int
    title: str
    description: str | None
    max_points: int
    time_limit_default: int
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
    geschlecht: str
    geburtsdatum: date | None
    username: str | None
    active: bool
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
