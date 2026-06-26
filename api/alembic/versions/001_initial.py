"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-23
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teachers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("password_hash", sa.Text, nullable=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="teacher"),
        sa.UniqueConstraint("first_name", "last_name", name="uq_teacher_name"),
    )

    op.create_table(
        "classes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(10), nullable=False, unique=True),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("symbol_emoji", sa.String(10), nullable=True),
        sa.Column("symbol_image", sa.Text, nullable=True),
    )

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("teacher_id", sa.Integer, sa.ForeignKey("teachers.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False),
        sa.Column("class_id", sa.Integer, sa.ForeignKey("classes.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False),
        sa.Column("points", sa.Integer, nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
    )
    op.create_index("idx_transactions_class_id", "transactions", ["class_id"])
    op.create_index("idx_transactions_teacher_id", "transactions", ["teacher_id"])
    op.create_index("idx_transactions_ts", "transactions", ["ts"])


def downgrade() -> None:
    op.drop_table("transactions")
    op.drop_table("classes")
    op.drop_table("teachers")
