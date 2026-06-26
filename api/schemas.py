from datetime import datetime
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
    symbol_emoji: str | None
    symbol_image: str | None
    total_points: int = 0

    model_config = {"from_attributes": True}


class ClassSymbolUpdate(BaseModel):
    symbol_emoji: str | None = None


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


class ParticipantJoin(BaseModel):
    name: str
    avatar: str = "cat"


class SessionOut(BaseModel):
    id: int
    join_code: str
    status: str
    current_question_idx: int
    quiz_id: int
    class_id: int
    points_awarded: int | None
    participant_count: int = 0

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str  # first_name + last_name or just last_name
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    teacher: TeacherOut
