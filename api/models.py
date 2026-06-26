from datetime import datetime
from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey, func, JSON, UniqueConstraint, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="teacher")

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="teacher")


class Class(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol_emoji: Mapped[str | None] = mapped_column(String(10), nullable=True)
    symbol_image: Mapped[str | None] = mapped_column(Text, nullable=True)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="class_")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", onupdate="CASCADE", ondelete="RESTRICT"))
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", onupdate="CASCADE", ondelete="RESTRICT"))
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    teacher: Mapped["Teacher"] = relationship(back_populates="transactions")
    class_: Mapped["Class"] = relationship(back_populates="transactions")


# ---------------------------------------------------------------------------
# Quiz
# ---------------------------------------------------------------------------

class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_points: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    time_limit_default: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    randomize_answers: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # path under data/quizzes/{id}/ where gfx assets live
    asset_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "classic" | "tue" | "test" | "assignment" | "competition" | "custom"
    quiz_type: Mapped[str] = mapped_column(String(30), nullable=False, server_default="classic")
    tags: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # target grade levels: e.g. [5,6,7] (null/empty = all grades)
    grades: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")

    questions: Mapped[list["QuizQuestion"]] = relationship(
        back_populates="quiz", order_by="QuizQuestion.order", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["QuizSession"]] = relationship(back_populates="quiz")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    # single | multi | survey | true_false
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preview_time: Mapped[int | None] = mapped_column(Integer, nullable=True)

    quiz: Mapped["Quiz"] = relationship(back_populates="questions")
    answers: Mapped[list["QuizAnswer"]] = relationship(
        back_populates="question", order_by="QuizAnswer.order", cascade="all, delete-orphan"
    )
    responses: Mapped[list["QuizResponse"]] = relationship(back_populates="question")


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # null for survey

    question: Mapped["QuizQuestion"] = relationship(back_populates="answers")


class QuizSession(Base):
    __tablename__ = "quiz_sessions"
    __table_args__ = (
        # A class can only earn points from a given quiz once
        UniqueConstraint("quiz_id", "class_id", name="uq_quiz_class"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="RESTRICT"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    join_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    # waiting | active | finished
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="waiting")
    current_question_idx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    points_awarded: Mapped[int | None] = mapped_column(Integer, nullable=True)

    quiz: Mapped["Quiz"] = relationship(back_populates="sessions")
    class_: Mapped["Class"] = relationship()
    teacher: Mapped["Teacher"] = relationship()
    participants: Mapped[list["QuizParticipant"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    responses: Mapped[list["QuizResponse"]] = relationship(back_populates="session")


class QuizParticipant(Base):
    __tablename__ = "quiz_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar: Mapped[str] = mapped_column(String(50), nullable=False, default="cat")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["QuizSession"] = relationship(back_populates="participants")
    responses: Mapped[list["QuizResponse"]] = relationship(back_populates="participant")


class QuizResponse(Base):
    __tablename__ = "quiz_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False)
    participant_id: Mapped[int] = mapped_column(ForeignKey("quiz_participants.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False)
    # JSON list of answer IDs chosen
    chosen_answer_ids: Mapped[list] = mapped_column(JSON, nullable=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # null for survey
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["QuizSession"] = relationship(back_populates="responses")
    participant: Mapped["QuizParticipant"] = relationship(back_populates="responses")
    question: Mapped["QuizQuestion"] = relationship(back_populates="responses")


# ---------------------------------------------------------------------------
# Häuser
# ---------------------------------------------------------------------------

class Haus(Base):
    __tablename__ = "haeuser"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False, server_default="#6366f1")
    logo_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    members: Mapped[list["HausMember"]] = relationship(back_populates="haus", cascade="all, delete-orphan")


class HausMember(Base):
    __tablename__ = "haus_members"
    __table_args__ = (UniqueConstraint("haus_id", "class_id", name="uq_haus_class"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    haus_id: Mapped[int] = mapped_column(ForeignKey("haeuser.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    haus: Mapped["Haus"] = relationship(back_populates="members")
    class_: Mapped["Class"] = relationship()


# ---------------------------------------------------------------------------
# Wettkämpfe
# ---------------------------------------------------------------------------

class Wettkampf(Base):
    __tablename__ = "wettkampf"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "knockout" | "round_robin"
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    # "draft" | "active" | "finished"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    max_points: Mapped[float] = mapped_column(Integer, nullable=False, default=10)
    trostpreis_points: Mapped[float] = mapped_column(Integer, nullable=False, default=1)
    # scoring system: "soccer" (3-1-0), "classic" (2-1-0), "tennis" (1-0), "custom"
    scoring_system: Mapped[str] = mapped_column(String(20), nullable=False, server_default="soccer")
    win_points: Mapped[float] = mapped_column(Integer, nullable=False, server_default="3")
    draw_points: Mapped[float] = mapped_column(Integer, nullable=False, server_default="1")
    loss_points: Mapped[float] = mapped_column(Integer, nullable=False, server_default="0")
    # "overall" | "per_group" | "both" | "gender" | "overall+gender" | "per_group+gender" | "per_group_merged" | "per_group_merged+gender"
    ranking_mode: Mapped[str] = mapped_column(String(50), nullable=False, server_default="overall")
    # number of rewarded places (1=only winner, 3=podium, etc.); None = use stages system
    rewarded_places: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    stages: Mapped[list["WettkampfStage"]] = relationship(
        back_populates="wettkampf", order_by="WettkampfStage.order", cascade="all, delete-orphan"
    )
    participants: Mapped[list["WettkampfTeilnehmer"]] = relationship(
        back_populates="wettkampf", order_by="WettkampfTeilnehmer.seed", cascade="all, delete-orphan"
    )
    matches: Mapped[list["WettkampfMatch"]] = relationship(
        back_populates="wettkampf",
        order_by="WettkampfMatch.round_number",
        cascade="all, delete-orphan",
    )


class WettkampfStage(Base):
    """One scoring tier (e.g. Viertelfinale, Halbfinale, Finale, Sieger)."""
    __tablename__ = "wettkampf_stage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wettkampf_id: Mapped[int] = mapped_column(ForeignKey("wettkampf.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)   # higher = later / more prestigious
    points: Mapped[float] = mapped_column(Integer, nullable=False)  # total points for reaching this stage

    wettkampf: Mapped["Wettkampf"] = relationship(back_populates="stages")


class WettkampfTeilnehmer(Base):
    """A participant (person or team) in a Wettkampf."""
    __tablename__ = "wettkampf_teilnehmer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wettkampf_id: Mapped[int] = mapped_column(ForeignKey("wettkampf.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    group: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # "m" | "f" | None
    gender: Mapped[str | None] = mapped_column(String(1), nullable=True)
    # optional link to a class for point awarding
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)

    wettkampf: Mapped["Wettkampf"] = relationship(back_populates="participants")
    class_: Mapped["Class | None"] = relationship()


class WettkampfMatch(Base):
    """A single match / pairing inside a Wettkampf."""
    __tablename__ = "wettkampf_match"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wettkampf_id: Mapped[int] = mapped_column(ForeignKey("wettkampf.id", ondelete="CASCADE"), nullable=False)
    stage_id: Mapped[int | None] = mapped_column(ForeignKey("wettkampf_stage.id", ondelete="SET NULL"), nullable=True)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)   # 0 = first round
    match_number: Mapped[int] = mapped_column(Integer, nullable=False)   # position within round
    p1_id: Mapped[int | None] = mapped_column(ForeignKey("wettkampf_teilnehmer.id", ondelete="SET NULL"), nullable=True)
    p2_id: Mapped[int | None] = mapped_column(ForeignKey("wettkampf_teilnehmer.id", ondelete="SET NULL"), nullable=True)
    winner_id: Mapped[int | None] = mapped_column(ForeignKey("wettkampf_teilnehmer.id", ondelete="SET NULL"), nullable=True)
    score_p1: Mapped[str | None] = mapped_column(String(20), nullable=True)
    score_p2: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_draw: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    wettkampf: Mapped["Wettkampf"] = relationship(back_populates="matches")
    stage: Mapped["WettkampfStage | None"] = relationship()
    p1: Mapped["WettkampfTeilnehmer | None"] = relationship(foreign_keys=[p1_id])
    p2: Mapped["WettkampfTeilnehmer | None"] = relationship(foreign_keys=[p2_id])
    winner: Mapped["WettkampfTeilnehmer | None"] = relationship(foreign_keys=[winner_id])
