import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Integer, String, Text, Boolean, DateTime, Date, ForeignKey, func, JSON, UniqueConstraint, Float, Index, LargeBinary
from sqlalchemy.sql import expression as sql_expr
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class TeacherRole(Base):
    """Professional role (Lehrer/SPF/…) — separate from Teacher.role, which is
    the account's auth level (teacher/admin). counts_as_teacher lets future
    logic (headcounts, reports) distinguish core teaching staff from support
    roles without hardcoding role names."""
    __tablename__ = "teacher_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    counts_as_teacher: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Generated login username (e.g. "m.mueller42"). Null for teachers created
    # before credential generation — they log in by "Vorname Nachname" instead.
    username: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Seed for generate_password(): lets us re-display a generated plaintext later
    # (CSV export). Null when the password was set manually, not generated.
    password_seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Encrypted-at-rest plaintext of a generated password, for re-display without
    # a recoverable seed. Null for manually-set (private) passwords. See pw_crypto.
    password_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Zwei-Faktor (TOTP) ------------------------------------------------
    # `totp_secret` steht ab dem Start der Einrichtung, `totp_confirmed` erst,
    # wenn ein echter Code geprueft wurde — eine abgebrochene Einrichtung kann
    # also niemanden aussperren. `totp_last_counter` ist der zuletzt
    # angenommene 30-Sekunden-Schritt und macht einen abgefangenen Code
    # innerhalb seines eigenen Fensters unbrauchbar. Siehe api/totp.py.
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    totp_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sql_expr.false())
    totp_last_counter: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # JSON-Liste bcrypt-gehashter Wiederherstellungscodes.
    recovery_codes: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    role: Mapped[str] = mapped_column(String(20), default="teacher")
    # Import-only metadata (school's own staff number, contact email)
    nummer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    teacher_role_id: Mapped[int | None] = mapped_column(ForeignKey("teacher_roles.id", ondelete="SET NULL"), nullable=True)
    # Set => this teacher is Klassenlehrer of that class. Two teachers can
    # share a klasse_id to form a Klassenleitungsteam (e.g. one Lehrer + one SPF).
    klasse_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    # Manual adjustment to total Wochenstunden (+/-), e.g. Abminderung for a
    # school function, or reduced hours for a part-time contract.
    korrektur: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    notiz: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Stunden nach Arbeitsvertrag (AvSt) — contracted weekly hours; null = not set.
    av_stunden: Mapped[int | None] = mapped_column(Integer, nullable=True)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="teacher")
    teacher_role: Mapped["TeacherRole | None"] = relationship()
    klasse: Mapped["Class | None"] = relationship(foreign_keys=[klasse_id])
    assignments: Mapped[list["TeacherAssignment"]] = relationship(
        back_populates="teacher", cascade="all, delete-orphan"
    )


class Class(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    class_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "Otter"
    symbol_emoji: Mapped[str | None] = mapped_column(String(10), nullable=True)
    symbol_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Stable Abschlussklasse identity (e.g. "AK2029a"), derived from `code` at the
    # school year's Stichtag (1. August). Lets a class keep its identity across the
    # yearly grade bump ("7a" -> "8a") for import matching. See api/schoolyear.py.
    ak_code: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    # When true, this class's Klassensprecher may edit the limited Klassenverwaltung
    # subset (Klassendienste + zusätzliche Sitzpläne). Toggled by the Klassenlehrer.
    ksprecher_can_edit: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Role types (Klassensprecher, ...) this class uses, curated by the Klassenlehrer.
    # NULL = never curated -> the defaults from api/routers/roles.py apply.
    role_types: Mapped[list | None] = mapped_column(JSON, nullable=True)

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
    preview_time_default: Mapped[int] = mapped_column(Integer, nullable=False, server_default="3")
    randomize_answers: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # path under data/quizzes/{id}/ where gfx assets live
    asset_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "classic" | "tue" | "test" | "assignment" | "competition" | "custom"
    quiz_type: Mapped[str] = mapped_column(String(30), nullable=False, server_default="classic")
    tags: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # target grade levels: e.g. [5,6,7] (null/empty = all grades)
    grades: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # Student author (shared student pool). NULL = teacher-authored content,
    # which students never see; non-NULL = created by a student and visible to
    # all students. Quizzes have no teacher `created_by` (all teachers share them).
    created_by_student: Mapped[int | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), nullable=True
    )

    questions: Mapped[list["QuizQuestion"]] = relationship(
        back_populates="quiz", order_by="QuizQuestion.order", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["QuizSession"]] = relationship(back_populates="quiz")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    # single | multi | survey | true_false | sort | umrechnung | timeline
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preview_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # type "timeline": the TimelineGameSpec (see api/timeline_engine.py) —
    # holds the solution values, so it is never sent to students raw.
    content: Mapped[dict | None] = mapped_column(JSON, nullable=True)

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
    """A quiz run, scoped to exactly one of class_id (a Klasse) or group_id
    (a Kurs/WPF). Kurse and Wahlpflicht groups are klassenuebergreifend, so a
    group session's points are split per participating Klasse — see
    points_by_class and api/scoping.py."""
    __tablename__ = "quiz_sessions"
    __table_args__ = (
        # A class can only earn points from a given quiz once
        UniqueConstraint("quiz_id", "class_id", name="uq_quiz_class"),
        # ... and so can a Kurs/WPF group. Both constraints coexist because the
        # unused column is NULL, and NULLs never collide in Postgres.
        UniqueConstraint("quiz_id", "group_id", name="uq_quiz_group"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="RESTRICT"), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="RESTRICT"), nullable=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id", ondelete="RESTRICT"), nullable=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    join_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    # waiting | active | finished
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="waiting")
    current_question_idx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Als einziges Sitzungsmodell hatte Caputh kein Anlagedatum — die
    # Schuljahresbereinigung (api/retention.py) braucht eins. Altbestaende
    # bleiben NULL und werden ueber started_at/finished_at datiert.
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Total handed out, summed over all participating classes. Kept as the one
    # number every existing reader (session list, host screen) already shows.
    points_awarded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # {"<class_id>": points} — the per-Klasse breakdown behind points_awarded.
    # Set for every scored session, so a single-class run has one entry.
    points_by_class: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    team_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # QR/join-link guests may join this session (teacher opt-in)
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)

    quiz: Mapped["Quiz"] = relationship(back_populates="sessions")
    class_: Mapped["Class | None"] = relationship()
    group: Mapped["StudentGroup | None"] = relationship()
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
    # Gast-Token-Id (uuid) fuer Teilnehmer ohne Konto. Ohne sie wurden Gaeste
    # allein am Namen erkannt — zwei "Max" landeten auf demselben Teilnehmer
    # und teilten sich Punkte und Antworten.
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    team_id: Mapped[int | None] = mapped_column(ForeignKey("quiz_teams.id", ondelete="SET NULL"), nullable=True)
    # Angemeldete Schueler werden mitgeschrieben, damit ihre Klasse feststeht.
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    # Die Klasse, der die Punkte dieses Teilnehmers zugute kommen. Bei einer
    # Klassensitzung immer die der Sitzung; bei Kurs/WPF die eigene Klasse des
    # angemeldeten Schuelers bzw. die vom Gast beim Beitritt gewaehlte.
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)

    session: Mapped["QuizSession"] = relationship(back_populates="participants")
    responses: Mapped[list["QuizResponse"]] = relationship(back_populates="participant")
    # Ohne diese Beziehung fiel die Rangliste auf "Team 3" zurueck, statt den
    # bei der Anlage eingegebenen Namen ("Jungen", "Maedchen") zu zeigen.
    team: Mapped["QuizTeam | None"] = relationship()


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
    is_draw: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())

    wettkampf: Mapped["Wettkampf"] = relationship(back_populates="matches")
    stage: Mapped["WettkampfStage | None"] = relationship()
    p1: Mapped["WettkampfTeilnehmer | None"] = relationship(foreign_keys=[p1_id])
    p2: Mapped["WettkampfTeilnehmer | None"] = relationship(foreign_keys=[p2_id])
    winner: Mapped["WettkampfTeilnehmer | None"] = relationship(foreign_keys=[winner_id])


# ---------------------------------------------------------------------------
# Students (shared across Hauspokal + Sportfest)
# ---------------------------------------------------------------------------

class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nummer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nachname: Mapped[str] = mapped_column(String(100), nullable=False)
    vorname: Mapped[str] = mapped_column(String(100), nullable=False, server_default="")
    klasse: Mapped[str] = mapped_column(String(10), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    jahrgang: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Stable Abschlussklasse identity (e.g. "AK2029a"), derived from `klasse` at import
    # time. Used to match a student across school years even after their grade-based
    # `klasse` label changes ("7a" -> "8a"). See api/schoolyear.py.
    ak_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    geschlecht: Mapped[str | None] = mapped_column(String(20), nullable=True)
    geburtsdatum: Mapped[date | None] = mapped_column(Date, nullable=True)
    username: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Seed for generate_password() — see Teacher.password_seed.
    password_seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Encrypted-at-rest plaintext of the login password, for re-display on cards /
    # the Zugangsdaten export when the password isn't seed-derived (e.g. reused from
    # an external system). See api/pw_crypto.py.
    password_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sql_expr.true())
    extra_fields: Mapped[dict] = mapped_column(JSON, nullable=False, server_default="{}")
    # Display alias for the Sitzplan: one of the student's first names, or a fully
    # custom name (e.g. for trans students). Null => fall back to `vorname`.
    alias: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Nachteilsausgleich — subset of [1,2,3,4,5], each an independent measure flag.
    nta: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")

    class_: Mapped["Class | None"] = relationship()
    sf_results: Mapped[list["SportfestResult"]] = relationship(back_populates="student", cascade="all, delete-orphan")
    # Kurse/WPF/A-B-Gruppen, in denen dieser Schueler steht. Nur lesend — die
    # Mitgliedschaft wird ueber StudentGroupMember gepflegt.
    group_memberships: Mapped[list["StudentGroupMember"]] = relationship(viewonly=True)


# ---------------------------------------------------------------------------
# Auth security
# ---------------------------------------------------------------------------

class AuditLog(Base):
    """Fortgeschriebenes Protokoll sicherheitsrelevanter Zugriffe (Art. 5 (2)
    DSGVO, Rechenschaftspflicht).

    Haelt bewusst **keine** personenbezogenen Inhalte fest — nur *wer* *welche
    Art* von Datensatz angefasst hat. Sonst waere das Protokoll eine zweite
    Kopie genau der Daten, die es schuetzen soll. `target` ist eine grobe
    Angabe (Klassenkuerzel, Benutzername, Anzahl), `detail` eine kurze Notiz.

    Nur schreiben, nie aendern: es gibt keinen Endpunkt, der Zeilen loescht.
    Uebernommen aus dem Werkstatt-Tool (backend/audit.py).
    """
    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_log_ts", "ts"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # Wer — Benutzername statt Fremdschluessel, damit die Zeile ein geloeschtes
    # Konto ueberlebt. `actor_id` nur als Hinweis, ohne FK.
    actor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    actor_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(60), nullable=False)      # z.B. "students.credentials.download"
    target: Mapped[str] = mapped_column(String(120), nullable=False, server_default="")
    detail: Mapped[str] = mapped_column(String(255), nullable=False, server_default="")
    ip: Mapped[str] = mapped_column(String(45), nullable=False, server_default="")  # IPv6-breit


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    __table_args__ = (Index("ix_revoked_tokens_expires", "expires_at"),)

    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


# ---------------------------------------------------------------------------
# Sportfest
# ---------------------------------------------------------------------------

class SportfestDiscipline(Base):
    __tablename__ = "sportfest_disciplines"

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.true())

    results: Mapped[list["SportfestResult"]] = relationship(back_populates="discipline", cascade="all, delete-orphan")


class SportfestResult(Base):
    __tablename__ = "sportfest_results"
    __table_args__ = (UniqueConstraint("student_id", "discipline_id", name="uq_sf_student_disc"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    discipline_id: Mapped[str] = mapped_column(
        String(30), ForeignKey("sportfest_disciplines.id", ondelete="CASCADE"), nullable=False
    )
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    student: Mapped["Student"] = relationship(back_populates="sf_results")
    discipline: Mapped["SportfestDiscipline"] = relationship(back_populates="results")


# ---------------------------------------------------------------------------
# Schreibraum (collaborative editor, based on EtherStud4Kids)
# ---------------------------------------------------------------------------

class SchreibraumRoom(Base):
    __tablename__ = "schreibraum_rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # "next-free-line" | "add-line"
    mode: Mapped[str] = mapped_column(String(20), nullable=False, server_default="next-free-line")
    is_permanent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sql_expr.true())
    # QR/join-link guests may join this room (teacher opt-in)
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["Teacher"] = relationship()
    participants: Mapped[list["SchreibraumParticipant"]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
    document: Mapped["SchreibraumDocument | None"] = relationship(
        back_populates="room", uselist=False, cascade="all, delete-orphan"
    )
    action_logs: Mapped[list["SchreibraumActionLog"]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
    access_grants: Mapped[list["SchreibraumAccess"]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )


class SchreibraumParticipant(Base):
    __tablename__ = "schreibraum_participants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schreibraum_rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Link to Hauspokal identity (one of these is set; all null = QR/join-link guest)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    # QR/join-link guest: the guest token's id (stable across reconnects, no DB user row)
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False)
    session_token: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, default=_uuid, index=True)
    is_teacher: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sql_expr.false())
    is_kicked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sql_expr.false())
    kicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejoin_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sql_expr.false())
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    room: Mapped["SchreibraumRoom"] = relationship(back_populates="participants")


class SchreibraumDocument(Base):
    __tablename__ = "schreibraum_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schreibraum_rooms.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    ydoc_state: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    room: Mapped["SchreibraumRoom"] = relationship(back_populates="document")


class SchreibraumActionLog(Base):
    __tablename__ = "schreibraum_action_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schreibraum_rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    participant_name: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    room: Mapped["SchreibraumRoom"] = relationship(back_populates="action_logs")


# ---------------------------------------------------------------------------
# Roles (Klassensprecher, Haussprecher, extendable)
# ---------------------------------------------------------------------------

class StudentRole(Base):
    __tablename__ = "student_roles"
    __table_args__ = (UniqueConstraint("student_id", "role_type", "scope_id", name="uq_student_role_scope"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    # "klassensprecher" | "haussprecher" | extendable
    role_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # class_id for klassensprecher, haus_id for haussprecher (null for global roles)
    scope_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship()
    assigner: Mapped["Teacher | None"] = relationship()


# ---------------------------------------------------------------------------
# Class Chores (Klassendienste)
# ---------------------------------------------------------------------------

class ClassChore(Base):
    __tablename__ = "class_chores"
    __table_args__ = (UniqueConstraint("class_id", "chore_name", name="uq_class_chore"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    chore_name: Mapped[str] = mapped_column(String(100), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.true())
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student | None"] = relationship("Student")
    assigner: Mapped["Teacher | None"] = relationship("Teacher")


class ClassChoreHistory(Base):
    """Records each completed chore assignment (held ≥ COMPLETION_DAYS days)."""
    __tablename__ = "class_chore_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    chore_name: Mapped[str] = mapped_column(String(100), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    student: Mapped["Student"] = relationship("Student")


# ---------------------------------------------------------------------------
# Class Trackers (e.g. Materialgeld, Ausflug bezahlt)
# ---------------------------------------------------------------------------

class ClassTracker(Base):
    """A checklist column ("Materialgeld", "Einverstaendnis") over a roster.

    Scoped to exactly one of class_id (a Klasse) or group_id (a Kurs/WPF)."""
    __tablename__ = "class_trackers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=True, index=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    checks: Mapped[list["ClassTrackerCheck"]] = relationship(back_populates="tracker", cascade="all, delete-orphan")


class ClassTrackerCheck(Base):
    __tablename__ = "class_tracker_checks"
    __table_args__ = (UniqueConstraint("tracker_id", "student_id", name="uq_tracker_student"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tracker_id: Mapped[int] = mapped_column(ForeignKey("class_trackers.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tracker: Mapped["ClassTracker"] = relationship(back_populates="checks")
    student: Mapped["Student"] = relationship("Student")


# ---------------------------------------------------------------------------
# Umfrage (Meinungsbarometer)
# ---------------------------------------------------------------------------

class BarometerSession(Base):
    __tablename__ = "barometer_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # "active" | "closed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # index of currently shown SLIDE (a slide may bundle several questions; -1 = lobby)
    current_question_idx: Mapped[int] = mapped_column(Integer, nullable=False, server_default="-1")
    # whether results are shown to students for current question
    results_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # visible to all teachers in the tool pool (vs. creator-only)
    shared: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # QR/join-link guests may join this session (teacher opt-in)
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    # "live" (teacher shows one question at a time) | "self" (students see all questions at once)
    mode: Mapped[str] = mapped_column(String(10), nullable=False, server_default="live", default="live")
    results_public: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false(), default=False)

    creator: Mapped["Teacher"] = relationship()
    questions: Mapped[list["BarometerQuestion"]] = relationship(
        back_populates="session", order_by="BarometerQuestion.order", cascade="all, delete-orphan"
    )
    responses: Mapped[list["BarometerResponse"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class BarometerQuestion(Base):
    __tablename__ = "barometer_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("barometer_sessions.id", ondelete="CASCADE"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    scale_min: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    scale_max: Mapped[int] = mapped_column(Integer, nullable=False, server_default="6")
    scale_min_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    scale_max_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "scale" | "choice" | "multi" | "text" | "number"
    kind: Mapped[str] = mapped_column(String(10), nullable=False, server_default="scale", default="scale")
    options: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    chart: Mapped[str | None] = mapped_column(String(20), nullable=True)
    analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # shown on the same slide as the previous question
    same_slide: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false(), default=False)
    # Aussagen-Block id; consecutive questions with the same id form one block
    block: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # heading shown above the question/block (block: stored on the first member)
    intro: Mapped[str | None] = mapped_column(Text, nullable=True)
    # {"question": <0-based index of the parent in the ordered question list>, "options": [option indices]}
    show_if: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # "zahlen" | "smileys_auf" | "smileys_ab"
    scale_style: Mapped[str] = mapped_column(String(20), nullable=False, server_default="zahlen", default="zahlen")
    max_choices: Mapped[int | None] = mapped_column(Integer, nullable=True)
    num_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    num_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)

    session: Mapped["BarometerSession"] = relationship(back_populates="questions")
    responses: Mapped[list["BarometerResponse"]] = relationship(back_populates="question", cascade="all, delete-orphan")


class BarometerResponse(Base):
    __tablename__ = "barometer_responses"
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", "student_id", name="uq_baro_student_question"),
        UniqueConstraint("session_id", "question_id", "guest_id", name="uq_baro_guest_question"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("barometer_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("barometer_questions.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    # QR/join-link guest: the guest token's id (dedupes anonymous votes per guest)
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    number: Mapped[float | None] = mapped_column(Float, nullable=True)
    # multi answers (sorted option indices). Not named `values` — reserved word in SQL.
    choices: Mapped[list | None] = mapped_column(JSON, nullable=True)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["BarometerSession"] = relationship(back_populates="responses")
    question: Mapped["BarometerQuestion"] = relationship(back_populates="responses")


# ---------------------------------------------------------------------------
# Punkte-Auktion
# ---------------------------------------------------------------------------

class AuctionSet(Base):
    """Reusable Auction content (title, description, prize) — the library,
    open to every teacher. An AuctionSession is one live bidding instance
    started from a set."""
    __tablename__ = "auction_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    prize_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["Teacher"] = relationship()
    sessions: Mapped[list["AuctionSession"]] = relationship(back_populates="set")


class AuctionSession(Base):
    __tablename__ = "auction_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    set_id: Mapped[int] = mapped_column(ForeignKey("auction_sets.id", ondelete="RESTRICT"), nullable=False)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    # "waiting" | "bidding" | "closed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="waiting")
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    winner_house_id: Mapped[int | None] = mapped_column(ForeignKey("haeuser.id", ondelete="SET NULL"), nullable=True)
    winning_bid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # QR/join-link guests may join this session (teacher opt-in)
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)

    creator: Mapped["Teacher"] = relationship()
    set: Mapped["AuctionSet"] = relationship(back_populates="sessions")
    bids: Mapped[list["AuctionBid"]] = relationship(back_populates="session", cascade="all, delete-orphan")

    # Passthroughs so every existing read site keeps working unchanged.
    @property
    def title(self) -> str: return self.set.title
    @property
    def description(self) -> str | None: return self.set.description
    @property
    def prize_description(self) -> str | None: return self.set.prize_description


class AuctionBid(Base):
    __tablename__ = "auction_bids"
    __table_args__ = (UniqueConstraint("session_id", "house_id", name="uq_auction_house"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("auction_sessions.id", ondelete="CASCADE"), nullable=False)
    house_id: Mapped[int] = mapped_column(ForeignKey("haeuser.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["AuctionSession"] = relationship(back_populates="bids")
    house: Mapped["Haus"] = relationship()


# ---------------------------------------------------------------------------
# Bingo
# ---------------------------------------------------------------------------

class BingoSet(Base):
    """Reusable Bingo content (title, pairs, grid shape) — the library, open
    to every teacher. A BingoSession is one live instance started from a set."""
    __tablename__ = "bingo_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    max_points: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    grid_size: Mapped[int] = mapped_column(Integer, nullable=False, server_default="3")
    grid_cols: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    # target grade levels: e.g. [5,6,7] (null/empty = all grades) — mirrors Quiz.grades
    grades: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # [{caller: str, answer: str}, ...]
    pairs: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # Author: exactly one of created_by (teacher) / created_by_student is set.
    # Student-authored sets (created_by_student non-NULL) form the shared
    # student pool; teacher sets are hidden from students.
    created_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=True)
    created_by_student: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["Teacher"] = relationship()
    student_creator: Mapped["Student"] = relationship()
    sessions: Mapped[list["BingoSession"]] = relationship(back_populates="set")


class BingoSession(Base):
    __tablename__ = "bingo_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    set_id: Mapped[int] = mapped_column(ForeignKey("bingo_sets.id", ondelete="RESTRICT"), nullable=False)
    # Class the round is played with. Anonymous players' points are credited
    # to this class on close; logged-in students credit their own class.
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    # Alternative zur Klasse: ein Kurs/WPF. Klassenuebergreifend, deshalb werden
    # die Punkte je Klasse der Spieler gebucht (siehe api/scoping.py).
    group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id", ondelete="SET NULL"), nullable=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    # indices of pairs called so far (in order)
    called_indices: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # "waiting" | "active" | "closed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="waiting")
    # Gesetzt, sobald die Runde ausgewertet und den Spielern ihr Ergebnis
    # geschickt wurde. Danach gibt es kein Wiederoeffnen: ein zweites
    # Schliessen wuerde dieselbe Runde ein zweites Mal verpunkten. Wer weiter
    # spielen will, setzt zurueck — das startet eine frische Runde und loescht
    # dieses Feld wieder.
    awarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # {"<class_id>": Punkte} — beim Auswerten festgehalten, damit die Runde
    # spaeter noch sagen kann, welche Klasse was bekommen hat.
    points_by_class: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # QR/join-link guests may join this session (teacher opt-in)
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)

    creator: Mapped["Teacher"] = relationship()
    group: Mapped["StudentGroup | None"] = relationship()
    set: Mapped["BingoSet"] = relationship(back_populates="sessions")
    cards: Mapped[list["BingoCard"]] = relationship(back_populates="session", cascade="all, delete-orphan")

    # Passthroughs so every existing read site (join/call-pair/close/reset/
    # card generation/BingoOut serialization) keeps working unchanged.
    @property
    def title(self) -> str: return self.set.title
    @property
    def subject(self) -> str | None: return self.set.subject
    @property
    def tags(self) -> list: return self.set.tags
    @property
    def description(self) -> str | None: return self.set.description
    @property
    def max_points(self) -> int: return self.set.max_points
    @property
    def grid_size(self) -> int: return self.set.grid_size
    @property
    def grid_cols(self) -> int: return self.set.grid_cols
    @property
    def pairs(self) -> list: return self.set.pairs


class BingoCard(Base):
    __tablename__ = "bingo_cards"
    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_bingo_student"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("bingo_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    # UUID token for anonymous (non-auth) participants, stored in their localStorage
    anon_token: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # Klasse, der die Punkte dieser Karte zugute kommen — bei Gaesten in einer
    # Kurs/WPF-Runde die beim Beitritt gewaehlte.
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # pair indices assigned to each grid cell (length = rows*cols)
    grid_indices: Mapped[list] = mapped_column(JSON, nullable=False)
    # 0-based cell positions that are marked
    marked_positions: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    has_bingo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())

    session: Mapped["BingoSession"] = relationship(back_populates="cards")


# ---------------------------------------------------------------------------
# Exit Ticket
# ---------------------------------------------------------------------------

class ExitTicketSession(Base):
    __tablename__ = "exit_ticket_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    rating_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.true())
    # "open" | "closed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="open")
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # QR/join-link guests may join this session (teacher opt-in)
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)

    creator: Mapped["Teacher"] = relationship()
    responses: Mapped[list["ExitTicketResponse"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class ExitTicketResponse(Base):
    __tablename__ = "exit_ticket_responses"
    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_exit_ticket_student"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("exit_ticket_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 1–5 rating, null if rating_enabled=False
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["ExitTicketSession"] = relationship(back_populates="responses")


# ---------------------------------------------------------------------------
# Caputh teams
# ---------------------------------------------------------------------------

class QuizTeam(Base):
    __tablename__ = "quiz_teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    session: Mapped["QuizSession"] = relationship()


class SchreibraumAccess(Base):
    """Who is allowed to join a room. Either a specific student or a whole class."""
    __tablename__ = "schreibraum_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schreibraum_rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=True)

    room: Mapped["SchreibraumRoom"] = relationship(back_populates="access_grants")
    student: Mapped["Student | None"] = relationship()
    class_: Mapped["Class | None"] = relationship()


# ---------------------------------------------------------------------------
# Stundenplaner
# ---------------------------------------------------------------------------

class LessonPlan(Base):
    __tablename__ = "lesson_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    fach: Mapped[str] = mapped_column(String(100), nullable=False, server_default="")
    klasse: Mapped[str] = mapped_column(String(50), nullable=False, server_default="")
    datum: Mapped[str | None] = mapped_column(String(10), nullable=True)
    dauer_min: Mapped[int] = mapped_column(Integer, nullable=False, server_default="45")
    lernziele: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    phasen: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    hausaufgaben: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    notizen: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    teacher: Mapped["Teacher"] = relationship()
    shares: Mapped[list["LessonPlanShare"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class LessonPlanShare(Base):
    __tablename__ = "lesson_plan_shares"
    __table_args__ = (UniqueConstraint("plan_id", "teacher_id", name="uq_lesson_share"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("lesson_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)

    plan: Mapped["LessonPlan"] = relationship(back_populates="shares")
    teacher: Mapped["Teacher"] = relationship()


class LessonSession(Base):
    """A 'live' run-through of a lesson plan — drives the guide sidebar's
    time-based phase highlighting. Only one active (ended_at IS NULL) session
    per teacher is expected; starting a new one ends any other active one."""
    __tablename__ = "lesson_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("lesson_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    plan: Mapped["LessonPlan"] = relationship()
    teacher: Mapped["Teacher"] = relationship()


class LessonMaterial(Base):
    """A file attached to a lesson-plan phase (image/PDF/office doc). Office
    docs are best-effort converted to PDF at upload time (pdf_filename)."""
    __tablename__ = "lesson_materials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("lesson_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    phase_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    pdf_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped["LessonPlan"] = relationship()


class LessonPlanClassShare(Base):
    """Scaffolding for sharing a lesson plan with a whole class. No
    student-facing read access is wired up yet — owner-side CRUD only."""
    __tablename__ = "lesson_plan_class_shares"
    __table_args__ = (UniqueConstraint("plan_id", "class_id", name="uq_lesson_class_share"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("lesson_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    plan: Mapped["LessonPlan"] = relationship()
    class_: Mapped["Class"] = relationship()


# ---------------------------------------------------------------------------
# Student groups (Kurse, Wahlpflicht, A/B-Gruppen — cross-class or intra-class)
# ---------------------------------------------------------------------------

class StudentGroup(Base):
    """A named grouping of students, used for point-awarding and organisation.

    group_type: "kurs" (Klasse 9/10 course split, e.g. "Kurs I")
              | "wahlpflicht" (Klasse 7+ elective, e.g. "DuG", "NaT", "Fr", "Span")
              | "ab_gruppe" (seating/work group "A"/"B", scoped to one class)
    class_id is set for group types that belong to a single class (ab_gruppe);
    left null for cross-class groups (kurs, wahlpflicht) whose member classes
    are derived from their students' class_id.
    grade is the Klassenstufe a cross-class group belongs to: "Kurs I" exists
    once per Jahrgang (9 and 10 are different courses), which is what the "10 K1"
    tag says. Null for ab_gruppe (already class-scoped) and for legacy rows whose
    grade could not be derived.
    """
    __tablename__ = "student_groups"
    __table_args__ = (UniqueConstraint("group_type", "class_id", "grade", "name", name="uq_group_type_class_grade_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_type: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=True)
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    class_: Mapped["Class | None"] = relationship()
    members: Mapped[list["StudentGroupMember"]] = relationship(back_populates="group", cascade="all, delete-orphan")


class StudentGroupMember(Base):
    __tablename__ = "student_group_members"
    __table_args__ = (UniqueConstraint("group_id", "student_id", name="uq_group_student"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)

    group: Mapped["StudentGroup"] = relationship(back_populates="members")
    student: Mapped["Student"] = relationship()


# ---------------------------------------------------------------------------
# Teacher assignments (prep for Klasse/Fach mapping, no UI yet)
# ---------------------------------------------------------------------------

class TeacherAssignment(Base):
    """Assigns a teacher to a subject taught in a class or cross-class group.

    e.g. Micha Müller -> Ma, class_id=5a; Micha Müller -> Ma, class_id=5b;
         Micha Müller -> Ma, group_id=<Kurs III>
    """
    __tablename__ = "teacher_assignments"
    __table_args__ = (
        UniqueConstraint("teacher_id", "subject", "class_id", "group_id", name="uq_teacher_assignment"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(50), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=True)

    teacher: Mapped["Teacher"] = relationship(back_populates="assignments")
    class_: Mapped["Class | None"] = relationship()
    group: Mapped["StudentGroup | None"] = relationship()


class SubjectWochenstunden(Base):
    """Weekly-hours (Wochenstunden) config per subject × grade, e.g. Ma/5 -> 4.
    Drives each teacher's total-hours computation from their assignments."""
    __tablename__ = "subject_wochenstunden"
    __table_args__ = (UniqueConstraint("subject", "grade", name="uq_subject_grade"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject: Mapped[str] = mapped_column(String(50), nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    hours: Mapped[int] = mapped_column(Integer, nullable=False)


class CalendarEntry(Base):
    """Single date or date-span calendar entry (Dienstberatung, Klassenfahrt, …).
    category = single-select AUDIENCE tier (Kollegium/Primar/Sekundar/
    Schulgemeinschaft/Ferien) — drives who can see the entry. Students only
    ever see 'Schulgemeinschaft'/'Ferien' entries (see calendar router).
    tags = free-form, colorable, multi-select descriptive labels (e.g.
    'Dienstberatung', 'Wandertag') — see CalendarTag for colors."""
    __tablename__ = "calendar_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.true())
    start_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "HH:MM", only if not all_day
    end_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["Teacher"] = relationship()


class SlideshowItem(Base):
    """One rotation slot on the Startseiten-Slideshow (kiosk display): an
    uploaded file, an external link, a calendar-tag feed, the Wochenspruch, or the singleton
    'hauspunkte' item. `position` drives both list ordering and rotation
    order. `audience` is the minimum viewer level required to see it
    ("guest" < "student" < "teacher"). `slot_days`/`slot_start`/`slot_end`
    (+ optional `slot_from`/`slot_until` date bounds) optionally restrict the
    item to a recurring weekly time window; see api/routers/slideshow.py for
    validation and warning computation."""
    __tablename__ = "slideshow_items"
    # sqlite_autoincrement: without it SQLite reuses a deleted row's rowid, which
    # would let a freshly lazy-created 'hauspunkte' item collide with a just-deleted
    # item's id (see _ensure_hauspunkte). No-op under Postgres.
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sql_expr.true())
    audience: Mapped[str] = mapped_column(String(10), nullable=False, default="guest", server_default="guest")
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=15, server_default="15")
    media_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    stored_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    calendar_tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    calendar_categories: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    calendar_days_ahead: Mapped[int] = mapped_column(Integer, nullable=False, default=14, server_default="14")
    slot_days: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    slot_start: Mapped[str | None] = mapped_column(String(5), nullable=True)
    slot_end: Mapped[str | None] = mapped_column(String(5), nullable=True)
    slot_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    slot_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CalendarTag(Base):
    """A reusable, colorable tag for calendar entries (name unique, e.g.
    'Dienstberatung' -> purple). Created ad hoc by teachers/admin from the
    Kalender UI, or seeded with the original default category set."""
    __tablename__ = "calendar_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False)  # "#rrggbb"


class SchoolSettings(Base):
    """Singleton (id=1) row for school-wide config, e.g. which Bundesland's
    Feriendaten to pull from OpenHolidaysAPI."""
    __tablename__ = "school_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bundesland: Mapped[str] = mapped_column(String(2), nullable=False, server_default="TH")
    # Darf das Geschlecht eines Schuelers ueberhaupt nach draussen? Aus, solange
    # es niemand braucht (Art. 25 DSGVO, Voreinstellung); anschalten laesst es
    # nur ein Admin. Aus heisst: kein `geschlecht` in irgendeiner Antwort, und
    # der Sitzplan zeigt das Kaestchen »Junge/Mädchen abwechselnd« nicht an.
    show_geschlecht: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sql_expr.false()
    )


# ---------------------------------------------------------------------------
# Exitgame — self-paced, session-based exit game (see api/routers/exitgame.py)
# ---------------------------------------------------------------------------

class ExitGame(Base):
    """Authored content: a self-contained JSON document of ordered slides
    (explanation/example/task/door), stored as one blob in `data` — no
    per-question WS lockstep here (unlike Quiz), so relational decomposition
    isn't needed. subject/grade/tags are denormalized copies of data fields
    for library filtering without parsing the blob."""
    __tablename__ = "exitgames"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject: Mapped[str] = mapped_column(String(100), nullable=False, server_default="")
    grade: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    asset_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    # Author: exactly one of created_by (teacher) / created_by_student is set.
    created_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=True)
    created_by_student: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["Teacher"] = relationship()
    student_creator: Mapped["Student"] = relationship()
    # Ohne Kaskade versucht SQLAlchemy beim Löschen eines Exitgames, die
    # exitgame_id seiner Sitzungen auf NULL zu setzen — die Spalte ist NOT NULL
    # (und die FK steht auf RESTRICT), das Löschen scheiterte also immer, sobald
    # das Spiel einmal gehostet wurde. Die Versuche und deren Ereignisse hängen
    # ihrerseits an der Sitzung und gehen mit.
    sessions: Mapped[list["ExitGameSession"]] = relationship(back_populates="exitgame", cascade="all, delete-orphan")


class ExitGameSession(Base):
    """A class-scoped window during which students can start/resume their own
    attempt — not a lockstep game like QuizSession, closer in spirit to
    ExitTicketSession's open/closed status."""
    __tablename__ = "exitgame_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exitgame_id: Mapped[int] = mapped_column(ForeignKey("exitgames.id", ondelete="RESTRICT"), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="RESTRICT"), nullable=True)
    # Alternative zur Klasse: ein Kurs/WPF. Reines Berichtsetikett — das
    # Exitgame vergibt keine Hauspunkte.
    group_id: Mapped[int | None] = mapped_column(ForeignKey("student_groups.id", ondelete="RESTRICT"), nullable=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    join_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="open")  # open | closed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # QR/join-link guests may join this session (teacher opt-in)
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)

    exitgame: Mapped["ExitGame"] = relationship(back_populates="sessions")
    class_: Mapped["Class | None"] = relationship()
    group: Mapped["StudentGroup | None"] = relationship()
    teacher: Mapped["Teacher"] = relationship()
    attempts: Mapped[list["ExitGameAttempt"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class ExitGameAttempt(Base):
    """One participant's self-paced run through an ExitGameSession. Resumable
    — re-opening the play page gets the same row back, not a new one.

    Anyone with the join link may play (session.class_id is a reporting
    label, not a gate) — a participant is either a Student (student_id set)
    or a Teacher/admin trying it out themselves (teacher_id set), or a
    QR/join-link guest (guest_id set — the guest token's id), never more
    than one. All three owner FKs/ids are nullable so Postgres's
    NULL-is-distinct unique semantics let each identity type have its own
    one-row-per-session uniqueness without a CHECK constraint."""
    __tablename__ = "exitgame_attempts"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_exitgame_attempt_student"),
        UniqueConstraint("session_id", "teacher_id", name="uq_exitgame_attempt_teacher"),
        UniqueConstraint("session_id", "guest_id", name="uq_exitgame_attempt_guest"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("exitgame_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    # QR/join-link guest: the guest token's id + the name they chose (no FK, no DB user row)
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    guest_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="in_progress")  # in_progress | finished
    current_slide_idx: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    solved_slide_ids: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    errors_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    hints_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    easier_taken_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["ExitGameSession"] = relationship(back_populates="attempts")
    student: Mapped["Student | None"] = relationship()
    teacher: Mapped["Teacher | None"] = relationship()
    events: Mapped[list["ExitGameEvent"]] = relationship(back_populates="attempt", cascade="all, delete-orphan")


class TaskGeneratorDef(Base):
    """Admin-authored task generator — a declarative alternative to
    api/task_generators.py's built-in Python generators, so a topic can be
    added by an admin (question template + variable ranges + a restricted
    arithmetic answer expression, see api/expr_eval.py) without a code
    change or any code-execution surface.

    `levels` is a JSON list (1-5 entries) of
    {template, vars: {name: [min,max]}, answer_expr, hint?}, indexed the
    same way as Exitgame's dda.levels — position 0 = easiest."""
    __tablename__ = "task_generator_defs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    subject: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    levels: Mapped[list] = mapped_column(JSON, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["Teacher"] = relationship()


class PracticeProgress(Base):
    """Per participant+topic practice state for the Übungsseite: current
    difficulty ladder position (1-5, streak-driven) and lifetime counters —
    the 'amount of tasks done' tracking teachers asked for. Open to everyone:
    a participant is a Student (student_id), a Teacher/admin trying it out
    (teacher_id) or a QR/join-link guest (guest_id — the guest token's id) —
    same pattern as ExitGameAttempt. Der Fortschritt eines Gastes lebt so
    lange wie sein Token: danach führt derselbe Name auf eine neue Zeile."""
    __tablename__ = "practice_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "topic", name="uq_practice_student_topic"),
        UniqueConstraint("teacher_id", "topic", name="uq_practice_teacher_topic"),
        UniqueConstraint("guest_id", "topic", name="uq_practice_guest_topic"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    topic: Mapped[str] = mapped_column(String(50), nullable=False)  # task_generators.REGISTRY id
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    streak_correct: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    streak_wrong: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    tasks_done: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    tasks_correct: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student: Mapped["Student"] = relationship()


class PracticeTask(Base):
    """One generated practice-task instance. The accepted answers are stored
    server-side at generation time so the check can never be steered by the
    client — the browser only ever sees the question text."""
    __tablename__ = "practice_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True, index=True)
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    topic: Mapped[str] = mapped_column(String(50), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    accept: Mapped[list] = mapped_column(JSON, nullable=False)
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Server-generated inline SVG sketch (geometry/stochastics tasks), stored
    # with the instance so question and image can never drift apart.
    image_svg: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Interactive Zahlenstrahl board (axis + prompt) for topics where the
    # student answers by placing a marker instead of typing; the accepted
    # values still live in `accept` (snapping makes exact matching valid).
    board: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    answered: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TimelineSet(Base):
    """Reusable Zeitstrahl content (axis, lanes, events) — the library, open
    to every teacher, following the BingoSet JSON-blob pattern. The set is
    the presentation/editing source; games (Caputh/Exitgame/Übung) embed a
    TimelineGameSpec built from these events (see api/timeline_engine.py)."""
    __tablename__ = "timeline_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # target grade levels: e.g. [5,6,7] (empty = all grades) — mirrors Quiz.grades
    grades: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # {kind: "year"|"number", min, max, step?, unit?}
    axis: Mapped[dict] = mapped_column(JSON, nullable=False)
    # [{id, label, color?}, ...]
    lanes: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # [{id, label, value, end?, lane?, info?, color?}, ...]
    events: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # Author: exactly one of created_by (teacher) / created_by_student is set.
    created_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=True)
    created_by_student: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student_creator: Mapped["Student"] = relationship()


class LueckentextSet(Base):
    """Reusable Lückentext content (cloze text with gaps) — the library, open
    to every teacher, following the BingoSet/TimelineSet JSON-blob pattern."""
    __tablename__ = "lueckentext_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # target grade levels: e.g. [5,6,7] (empty = all grades) — mirrors Quiz.grades
    grades: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    text: Mapped[str] = mapped_column(Text, nullable=False)  # cloze template with {{gap_id}} placeholders
    gaps: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")  # list of gap dicts
    distractors: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")  # extra word-bank words, never a correct answer
    # Author: exactly one of created_by (teacher) / created_by_student is set.
    created_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=True)
    created_by_student: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["Teacher"] = relationship()
    student_creator: Mapped["Student"] = relationship()


class LueckentextSession(Base):
    """One live play instance started from a LueckentextSet."""
    __tablename__ = "lueckentext_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lueckentext_id: Mapped[int] = mapped_column(ForeignKey("lueckentext_sets.id", ondelete="RESTRICT"), nullable=False)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    join_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    # waiting | active | finished
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="waiting")
    # Nullable on purpose: sessions hosted before this column existed have no
    # honest value, and stamping them with the migration date would lie.
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # QR/join-link guests may join this session (teacher opt-in)
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)

    lueckentext: Mapped["LueckentextSet"] = relationship()
    teacher: Mapped["Teacher"] = relationship()
    participants: Mapped[list["LueckentextParticipant"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    responses: Mapped[list["LueckentextResponse"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class LueckentextParticipant(Base):
    __tablename__ = "lueckentext_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("lueckentext_sessions.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar: Mapped[str] = mapped_column(String(50), nullable=False, default="cat")
    # Wie bei QuizParticipant: erkennt denselben Gast beim Neuladen wieder,
    # statt bei jedem Beitritt eine weitere Zeile anzulegen.
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # Nicht zu erratender Schluessel fuer den eigenen PDF-Download am Ende der
    # Runde. Der Download steht Gaesten ohne Konto offen, kann also nicht an
    # einer Anmeldung haengen — die fortlaufende `id` waere im Link aber ein
    # Nachbarblatt weit entfernt (URL um eins hochzaehlen), samt Namen im
    # Dateinamen. Siehe export_participant_pdf in routers/lueckentexte.py.
    export_token: Mapped[str] = mapped_column(String(36), nullable=False, default=_uuid, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["LueckentextSession"] = relationship(back_populates="participants")
    responses: Mapped[list["LueckentextResponse"]] = relationship(back_populates="participant", cascade="all, delete-orphan")


class LueckentextResponse(Base):
    """Per-gap progress for one participant. gap_id is a plain string matching
    the gap's "id" key in LueckentextSet.gaps JSON — not a foreign key."""
    __tablename__ = "lueckentext_responses"
    __table_args__ = (UniqueConstraint("participant_id", "gap_id", name="uq_lueckentext_participant_gap"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("lueckentext_sessions.id", ondelete="CASCADE"), nullable=False)
    participant_id: Mapped[int] = mapped_column(ForeignKey("lueckentext_participants.id", ondelete="CASCADE"), nullable=False)
    gap_id: Mapped[str] = mapped_column(String(100), nullable=False)
    given_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    match: Mapped[str | None] = mapped_column(String(10), nullable=True)  # exact | near | wrong | null (unattempted)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hints_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    revealed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hint_shown: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    first_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    solved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["LueckentextSession"] = relationship(back_populates="responses")
    participant: Mapped["LueckentextParticipant"] = relationship(back_populates="responses")


class LueckentextErrorPattern(Base):
    """Best-effort cross-session tracking of a student's recurring misses on a
    specific gap, keyed by (set, normalized display name, gap) since the app
    has no student login — matches how every other game here already
    identifies "the same student" only by re-typed display name. Used to bias
    reveal_state() more generous for a name/gap pair that keeps getting missed,
    even across separate sessions of the same LueckentextSet."""
    __tablename__ = "lueckentext_error_patterns"
    __table_args__ = (UniqueConstraint("lueckentext_id", "normalized_name", "gap_id", name="uq_lueckentext_error_pattern"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lueckentext_id: Mapped[int] = mapped_column(ForeignKey("lueckentext_sets.id", ondelete="CASCADE"), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(100), nullable=False)
    gap_id: Mapped[str] = mapped_column(String(100), nullable=False)
    miss_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ExitGameEvent(Base):
    """The detailed per-student log: one row per interaction (slide viewed,
    answer attempt, hint requested, easier-alternative offered/taken, door
    review jump). Durable audit trail teachers can review, and the input
    history the server-side DDA (api/dda.py) reads to adapt hint budgets."""
    __tablename__ = "exitgame_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("exitgame_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    slide_id: Mapped[str] = mapped_column(String(100), nullable=False)
    # view | attempt | hint | success | fail | easier_offered | easier_taken | review_jump
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    attempt: Mapped["ExitGameAttempt"] = relationship(back_populates="events")


# ---------------------------------------------------------------------------
# Sitzplan (seating plan per class)
# ---------------------------------------------------------------------------

class SeatingPlan(Base):
    """A named room layout for a class (e.g. "Klassenraum", "Kunstraum"). The
    whole layout lives in one JSON blob (`items`) like LessonPlan.phases — loaded
    and saved as a unit by the canvas editor. Seat.student_id values reference
    students loosely (resolved to names client-side; unknown ids treated empty)."""
    __tablename__ = "seating_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Exactly one scope is set: a Klasse (class_id) or a Kurs/WPF (group_id).
    class_id: Mapped[int | None] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, server_default="Klassenraum")
    # "landscape" | "portrait" — drives canvas shape and A4 PDF orientation
    orientation: Mapped[str] = mapped_column(String(20), nullable=False, server_default="landscape")
    # furniture array; each item: {id, kind, x, y, rotation, locked, label, seats:[{id, student_id, locked}]}
    items: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    class_: Mapped["Class | None"] = relationship()
    group: Mapped["StudentGroup | None"] = relationship()


# ---------------------------------------------------------------------------
# Tool availability (which audience may use/host/create/upload per tool)
# ---------------------------------------------------------------------------

class ToolAvailability(Base):
    """One allow/deny override for a (tool, capability, audience[, class|group]) tuple.

    A row's absence means "fall back": from a group row to its class row, from a
    class row to the global one (class_id and group_id both NULL), and ultimately
    to the catalog default in api/tool_catalog.py. `class_id` non-NULL = a
    per-class override a class teacher (or admin) set; `group_id` non-NULL = an
    override for one student group (in practice an A/B-Gruppe, i.e. half a class).
    At most one of the two is set. `audience` is "teacher" or "student";
    Klassensprecher count as students here. Group rows only ever bite students —
    teachers are not group members. See api/availability.py for the resolution order."""
    __tablename__ = "tool_availability"
    __table_args__ = (
        UniqueConstraint("tool_slug", "capability", "audience", "class_id", "group_id",
                         name="uq_tool_availability_scope"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tool_slug: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    capability: Mapped[str] = mapped_column(String(20), nullable=False)  # use | host | create | upload
    audience: Mapped[str] = mapped_column(String(20), nullable=False)    # teacher | student
    # NULL = global default; else scoped to this class.
    class_id: Mapped[int | None] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Enger als eine Klasse: eine A/B-Gruppe. Genau eines von beiden ist gesetzt.
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=True, index=True
    )
    allowed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Admin feature grants (grant an admin area to a teacher group / individual)
# ---------------------------------------------------------------------------

class AdminFeatureGrant(Base):
    """Grants one admin feature (api/admin_features.py) to either a whole teacher
    group (``teacher_role_id`` set) or an individually trusted teacher
    (``teacher_id`` set) — exactly one of the two per row. Admins always have
    every feature regardless of grants. See api/admin_access.py."""
    __tablename__ = "admin_feature_grants"
    __table_args__ = (
        UniqueConstraint("feature_slug", "teacher_role_id", "teacher_id",
                         name="uq_admin_feature_grant"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feature_slug: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    teacher_role_id: Mapped[int | None] = mapped_column(
        ForeignKey("teacher_roles.id", ondelete="CASCADE"), nullable=True
    )
    teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Fragments — TaskCards-style boards of text cards + media clippings.
# A collection is owned by a teacher; who else may see/edit it is driven
# entirely by FragmentCollectionGrant rows (see api/routers/fragments.py).
# ---------------------------------------------------------------------------

class FragmentCollection(Base):
    """A board of cards (text fragments + media clippings), owned by a teacher.

    Access is derived from FragmentCollectionGrant rows:
      * no grants                -> creator-only (private to the owner)
      * grant(all_teachers)      -> every teacher ("public") at that permission
      * grant(class, class_id=X) -> students of class X at that permission
    The owner always has full ('manage') rights, regardless of grants.
    Guests (QR / join link) get `guest_permission` when `allow_guests` is on.
    """
    __tablename__ = "fragment_collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Custom tab names (JSON list of strings); the builtin tabs live in code.
    fragment_tabs: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # Guest (QR / join-link) access — opt-in, with a stable join code.
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    guest_code: Mapped[str | None] = mapped_column(String(12), unique=True, nullable=True, index=True)
    guest_permission: Mapped[str] = mapped_column(String(20), nullable=False, server_default="read")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner: Mapped["Teacher"] = relationship()
    grants: Mapped[list["FragmentCollectionGrant"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan"
    )
    fragments: Mapped[list["Fragment"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan"
    )
    research_items: Mapped[list["ResearchItem"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan"
    )


class FragmentCollectionGrant(Base):
    """One access grant on a collection for an audience group.

    grantee_type = 'all_teachers' -> every teacher       (class_id/teacher_id NULL)
    grantee_type = 'class'        -> students of class_id
    grantee_type = 'group'        -> members of student group group_id — in practice
                                     an A/B-Gruppe, i.e. half a class
    grantee_type = 'teacher'      -> one specific teacher (teacher_id) — lets an
                                     owner add a colleague to an otherwise private board
    permission   = 'read' | 'contribute' | 'manage'
    """
    __tablename__ = "fragment_collection_grants"
    __table_args__ = (
        UniqueConstraint("collection_id", "grantee_type", "class_id", "teacher_id", "group_id",
                         name="uq_fragment_grant"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("fragment_collections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    grantee_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'all_teachers' | 'class' | 'group' | 'teacher'
    class_id: Mapped[int | None] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=True
    )
    teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True
    )
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=True
    )
    permission: Mapped[str] = mapped_column(String(20), nullable=False, server_default="read")

    collection: Mapped["FragmentCollection"] = relationship(back_populates="grants")
    class_: Mapped["Class | None"] = relationship()
    teacher: Mapped["Teacher | None"] = relationship()
    group: Mapped["StudentGroup | None"] = relationship()


class Fragment(Base):
    """A small text card in a collection tab (snippets, ideas, archive, custom)."""
    __tablename__ = "fragments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("fragment_collections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tab: Mapped[str] = mapped_column(String(100), nullable=False, server_default="snippets")
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True, server_default="")
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    # Author — lets 'contribute' grants restrict editing to a card's own creator.
    # kind = 'teacher' | 'student' | 'guest'; author_id is teacher/student PK (NULL for guests).
    author_kind: Mapped[str | None] = mapped_column(String(10), nullable=True)
    author_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    author_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    collection: Mapped["FragmentCollection"] = relationship(back_populates="fragments")


class ResearchItem(Base):
    """A research clipping in a collection — URL, text excerpt, and/or media gallery.

    Ported from foliantica; re-scoped from project_id to collection_id.
    """
    __tablename__ = "research_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("fragment_collections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tab: Mapped[str] = mapped_column(String(100), nullable=False, server_default="research")
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    url_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    url_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    url_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # Author — same scheme as Fragment.
    author_kind: Mapped[str | None] = mapped_column(String(10), nullable=True)
    author_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    author_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    collection: Mapped["FragmentCollection"] = relationship(back_populates="research_items")
    media: Mapped[list["ResearchMedia"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="ResearchMedia.order_index",
    )


class ResearchMedia(Base):
    """One image or PDF attached to a ResearchItem (multiple per item allowed)."""
    __tablename__ = "research_media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    research_item_id: Mapped[int] = mapped_column(
        ForeignKey("research_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # 'image' | 'pdf'
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    item: Mapped["ResearchItem"] = relationship(back_populates="media")


class ToolSession(Base):
    """A joinable session for a tool that keeps no state of its own.

    Abakus, Gleichungswaage, Bildformate, Tippen und der Zeitstrahl laufen ganz
    im Browser — es gibt nichts zu hosten. Die Zeile existiert nur, damit eine
    Lehrkraft Code/QR ausgeben und den Gastzugang freischalten kann; der Code
    ist je Lehrkraft, Werkzeug und Inhalt stabil, damit ein gedruckter QR
    weiter funktioniert.
    """
    __tablename__ = "tool_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    tool_slug: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # "open" | "closed". Geschlossen laesst niemanden mehr herein, der Code
    # bleibt aber bestehen — gedruckte QR sollen nach dem Wiederoeffnen
    # weiterhin stimmen.
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="open")
    # Auf welchen Inhalt die Sitzung zeigt, wenn das Werkzeug einen hat:
    # Zeitstrahl teilt eine bestimmte Zeitleiste (TimelineSet.id). Abakus & Co.
    # haben nichts zu waehlen und lassen das Feld leer.
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # QR/join-link guests may open this session (teacher opt-in)
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_expr.false())
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)

    creator: Mapped["Teacher"] = relationship()


class SimBeitrag(Base):
    """Ein abgegebenes Ergebnis aus einer Simulation — bisher: der Text, den
    jemand in der KI-Werkstatt durch das Wortnetz geschrieben hat.

    Die Simulationen rechnen sonst ganz im Browser; hier gibt es genau einen
    Grund für eine Zeile in der Datenbank: die Klasse soll ihre Ergebnisse
    nebeneinander sehen. Deshalb hängt der Beitrag an der Sitzung (dem Code)
    und nicht an einer Klasse — wer denselben QR gescannt hat, gehört dazu.

    Teilnehmer ist ein Schüler (student_id), eine Lehrkraft (teacher_id) oder
    ein Gast (guest_id, die Id aus dem Gast-Token) — dasselbe Muster wie bei
    PracticeProgress. Je Teilnehmer bleibt nur der letzte Beitrag stehen: ein
    zweiter Durchgang ersetzt den ersten, sonst füllt ein einzelnes Kind die
    Tafel.

    `wert` ist die Erwartbarkeit des Textes (0–1, geometrisches Mittel der
    gewählten Wahrscheinlichkeiten). Danach wird sortiert — oben steht der
    Text, den die Maschine am ehesten selbst geschrieben hätte.
    """
    __tablename__ = "sim_beitraege"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("tool_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Welches Thema des Wortnetzes (katze, …) — die Tafel gruppiert danach.
    thema: Mapped[str] = mapped_column(String(50), nullable=False, server_default="")
    text: Mapped[str] = mapped_column(Text, nullable=False)
    wert: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    # Reglerstellung »Auswahl« (0–5) und der Fingerabdruck der Wortwahl.
    mut: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    signatur: Mapped[str] = mapped_column(String(16), nullable=False, server_default="")
    erstellt_am: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["ToolSession"] = relationship()


class SnapProject(Base):
    """Ein Snap!-Programm (Berkeley) als XML-Blob.

    Snap! selbst kennt nur Datei-Export und seine eigene Cloud; hier liegt das
    Projekt stattdessen in Hauspokal, damit Schüler es an jedem Rechner
    weiterbearbeiten können. Das XML kommt aus der Snap!-API
    (`getProjectXML()`) und geht unverändert wieder an sie zurück — es wird
    absichtlich nicht geparst.

    Autor ist entweder ein Lehrer (created_by) oder ein Schüler
    (created_by_student), wie bei den übrigen Inhaltsbibliotheken. Setzt ein
    Lehrer zusätzlich class_id, wird das Projekt zur Vorlage: die Klasse sieht
    es und öffnet es, speichern kann sie es nur als eigene Kopie.
    """
    __tablename__ = "snap_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    xml: Mapped[str] = mapped_column(Text, nullable=False)
    # Gesetzt = Vorlage für diese Klasse (nur bei Lehrer-Projekten sinnvoll).
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    # Autor: genau eines von created_by (Lehrer) / created_by_student ist gesetzt.
    created_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=True)
    created_by_student: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TippSammlung(Base):
    """Hochgeladenes Tippmaterial — Diktate und Fachbegriffe statt der
    eingebauten Lektionen.

    Eine Sammlung bringt Texte mit (die abgetippt werden) und optional eine
    eigene Wortliste für den Wortregen: so üben die Finger an genau den
    Begriffen, um die es im Fach gerade geht. Folgt dem JSON-Blob-Muster von
    LueckentextSet/BingoSet — der Inhalt liegt als JSON in der Zeile, nicht in
    eigenen Tabellen.
    """
    __tablename__ = "tipp_sammlungen"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # [{"title": "Die Zelle", "text": "..."}]
    texts: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # Optionale Wortliste für den Wortregen.
    words: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # {"lock_on_error": true}
    settings: Mapped[dict] = mapped_column(JSON, nullable=False, server_default="{}")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped["Teacher"] = relationship()


class WettschreibenSession(Base):
    """Ein Tipp-Rennen: alle tippen denselben Text, die Balken laufen live.

    Der Text wird beim Anlegen kopiert statt verlinkt — wird die Sammlung
    später gelöscht oder geändert, bleibt das gelaufene Rennen erklärbar.
    """
    __tablename__ = "wettschreiben_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # lobby → laeuft → fertig
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="lobby")
    allow_guests: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="0")
    # Zaehler fuer »Gastzugang neu starten«. Jedes Gast-Token merkt sich den
    # Stand bei seiner Ausgabe; erhoeht die Lehrkraft ihn, sind alle aelteren
    # Token verbraucht — so kommt die naechste Klasse an denselben gedruckten
    # QR, ohne dass die vorige noch drinsitzt.
    #
    # Bewusst ein Zaehler und kein Zeitstempel: `iat` im JWT ist auf ganze
    # Sekunden gerundet, ein Zeitvergleich koennte einen Neustart und einen
    # Beitritt in derselben Sekunde nicht auseinanderhalten.
    guest_epoch: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    created_by: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    teilnehmer: Mapped[list["WettschreibenTeilnehmer"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class WettschreibenTeilnehmer(Base):
    """Wer mitschreibt — angemeldet oder als Gast über den QR.

    Der laufende Fortschritt steht NICHT hier: er fliegt über den WebSocket und
    liegt solange im Speicher. Erst das Ergebnis am Ziel wird gespeichert, sonst
    schriebe jede Klasse bei jedem Anschlag in die Datenbank.
    """
    __tablename__ = "wettschreiben_teilnehmer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("wettschreiben_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    guest_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Endstand, gefüllt wenn das Rennen für diesen Teilnehmer vorbei ist.
    pos: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    anschlaege: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    fehler: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    dauer_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["WettschreibenSession"] = relationship(back_populates="teilnehmer")


class TippBestenliste(Base):
    """Bestenliste der Schreibübung — eine Zeile je Person und Modus.

    Gespeichert wird nur die *beste* Leistung: sonst füllte ein einzelnes
    schnelles Kind die ganze Liste, und die hundert Plätze sagten nichts mehr
    über die Schule aus. Der Name wird beim Eintragen aus dem Konto abgeleitet,
    nie vom Browser übernommen.

    Gäste ohne Konto tragen sich nicht ein: eine Rangliste aus frei gewählten
    Namen wäre keine.
    """
    __tablename__ = "tipp_bestenliste"
    __table_args__ = (
        UniqueConstraint("modus", "student_id", name="uq_tipp_beste_student"),
        UniqueConstraint("modus", "teacher_id", name="uq_tipp_beste_teacher"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # lektionen | wortregen | tastenjagd
    modus: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    klasse: Mapped[str | None] = mapped_column(String(10), nullable=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    # Die Zahl, nach der sortiert wird — je Modus etwas anderes, siehe Router.
    wert: Mapped[float] = mapped_column(Float, nullable=False)
    anschlaege: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    fehler: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    dauer_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    # Woran gemessen wurde: Lektionstitel, Lektionsstufe des Spiels, …
    kontext: Mapped[str | None] = mapped_column(String(200), nullable=True)
    erreicht_am: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MausBestenliste(Base):
    """Bestenliste des »Maus-Führerscheins« — eine Zeile je Person und Modus.

    Anders als bei der Schreibübung dürfen hier auch Gäste ohne Konto
    mitspielen: sie kommen über den Sitzungscode (siehe SimBeitrag) und
    tragen sich über ``guest_id`` ein statt über eine Fremdschlüssel-Beziehung
    auf ein Konto.
    """
    __tablename__ = "maus_bestenliste"
    __table_args__ = (
        UniqueConstraint("modus", "student_id", name="uq_maus_beste_student"),
        UniqueConstraint("modus", "teacher_id", name="uq_maus_beste_teacher"),
        UniqueConstraint("modus", "guest_id", name="uq_maus_beste_guest"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # klick | doppelklick | ziehen | gesamt
    modus: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    klasse: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gast: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # Die Zahl, nach der sortiert wird — je Modus etwas anderes, siehe Router.
    wert: Mapped[float] = mapped_column(Float, nullable=False)
    dauer_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    # Woran gemessen wurde: Lektionstitel, Übungsstufe, …
    kontext: Mapped[str | None] = mapped_column(String(200), nullable=True)
    erreicht_am: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Ob diese Bestleistung mit eingeschalteter Hilfestellung erzielt wurde.
    hilfe: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")


class MausFortschritt(Base):
    """Fortschritt einer Person in einer Maus-Sitzung — eine Zeile je Teilnehmer,
    damit die Lehrkraft live sieht, wer welche Stufe des Führerscheins schon
    geschafft hat. Anders als die Bestenliste ist das an eine konkrete Sitzung
    gebunden, nicht global."""
    __tablename__ = "maus_fortschritt"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_maus_fortschritt_student"),
        UniqueConstraint("session_id", "teacher_id", name="uq_maus_fortschritt_teacher"),
        UniqueConstraint("session_id", "guest_id", name="uq_maus_fortschritt_guest"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("tool_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    guest_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    klasse: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gast: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    hilfe: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # {"<stufen_id>": {"punkte": int, "sterne": int, "dauer_ms": int}}
    stufen: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, server_default="{}")
    # Liste der bestandenen Teile (1 und/oder 2).
    bestanden: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    aktualisiert_am: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class MausPruefung(Base):
    """Bestandene Abschlussprüfung eines Teils des Maus-Führerscheins — je
    Schüler:in und Teil genau einmal, damit die Hauspunkte nicht doppelt
    vergeben werden."""
    __tablename__ = "maus_pruefungen"
    __table_args__ = (UniqueConstraint("student_id", "teil", name="uq_maus_pruefung_student_teil"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    teil: Mapped[int] = mapped_column(Integer, nullable=False)
    punkte: Mapped[int] = mapped_column(Integer, nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    bestanden_am: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
