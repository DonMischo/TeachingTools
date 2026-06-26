"""add grade to quizzes

Revision ID: 010
Revises: 009
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("quizzes", sa.Column("grade", sa.Integer, nullable=True))


def downgrade():
    op.drop_column("quizzes", "grade")
