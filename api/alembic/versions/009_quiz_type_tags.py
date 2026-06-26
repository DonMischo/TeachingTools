"""add quiz_type and tags to quizzes

Revision ID: 009
Revises: 008
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("quizzes", sa.Column("quiz_type", sa.String(30), nullable=False, server_default="classic"))
    op.add_column("quizzes", sa.Column("tags", sa.JSON, nullable=False, server_default=sa.text("'[]'::json")))


def downgrade():
    op.drop_column("quizzes", "tags")
    op.drop_column("quizzes", "quiz_type")
