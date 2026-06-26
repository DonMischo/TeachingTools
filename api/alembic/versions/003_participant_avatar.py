"""add avatar to quiz_participants

Revision ID: 003
Revises: 002
Create Date: 2026-06-23
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quiz_participants",
        sa.Column("avatar", sa.String(50), nullable=False, server_default="cat"),
    )


def downgrade() -> None:
    op.drop_column("quiz_participants", "avatar")
