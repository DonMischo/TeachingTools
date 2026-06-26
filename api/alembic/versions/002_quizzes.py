"""quiz tables

Revision ID: 002
Revises: 001
Create Date: 2026-06-23
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quizzes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("max_points", sa.Integer, nullable=False, server_default="100"),
        sa.Column("time_limit_default", sa.Integer, nullable=False, server_default="20"),
        sa.Column("randomize_answers", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("asset_path", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "quiz_questions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("quiz_id", sa.Integer, sa.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order", sa.Integer, nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("question_text", sa.Text, nullable=False),
        sa.Column("image_path", sa.Text, nullable=True),
        sa.Column("time_limit", sa.Integer, nullable=True),
    )
    op.create_index("idx_quiz_questions_quiz_id", "quiz_questions", ["quiz_id"])

    op.create_table(
        "quiz_answers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("question_id", sa.Integer, sa.ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order", sa.Integer, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("correct", sa.Boolean, nullable=True),
    )
    op.create_index("idx_quiz_answers_question_id", "quiz_answers", ["question_id"])

    op.create_table(
        "quiz_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("quiz_id", sa.Integer, sa.ForeignKey("quizzes.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("class_id", sa.Integer, sa.ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("teacher_id", sa.Integer, sa.ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("join_code", sa.String(8), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="waiting"),
        sa.Column("current_question_idx", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("points_awarded", sa.Integer, nullable=True),
        sa.UniqueConstraint("quiz_id", "class_id", name="uq_quiz_class"),
    )

    op.create_table(
        "quiz_participants",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.Integer, sa.ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_quiz_participants_session_id", "quiz_participants", ["session_id"])

    op.create_table(
        "quiz_responses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.Integer, sa.ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("participant_id", sa.Integer, sa.ForeignKey("quiz_participants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer, sa.ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chosen_answer_ids", sa.JSON, nullable=False),
        sa.Column("is_correct", sa.Boolean, nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_quiz_responses_session_id", "quiz_responses", ["session_id"])
    op.create_index("idx_quiz_responses_participant_question", "quiz_responses", ["participant_id", "question_id"])


def downgrade() -> None:
    op.drop_table("quiz_responses")
    op.drop_table("quiz_participants")
    op.drop_table("quiz_sessions")
    op.drop_table("quiz_answers")
    op.drop_table("quiz_questions")
    op.drop_table("quizzes")
