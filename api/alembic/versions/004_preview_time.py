"""add preview_time to quiz_questions

Revision ID: 004
Revises: 003
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("quiz_questions", sa.Column("preview_time", sa.Integer, nullable=True))


def downgrade():
    op.drop_column("quiz_questions", "preview_time")
