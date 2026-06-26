"""replace grade (int) with grades (json array) on quizzes

Revision ID: 011
Revises: 010
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("quizzes", "grade")
    op.add_column("quizzes", sa.Column("grades", sa.JSON, nullable=False, server_default=sa.text("'[]'::json")))


def downgrade():
    op.drop_column("quizzes", "grades")
    op.add_column("quizzes", sa.Column("grade", sa.Integer, nullable=True))
