"""add ranking_mode to wettkampf

Revision ID: 008
Revises: 007
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("wettkampf", sa.Column("ranking_mode", sa.String(20), nullable=False, server_default="overall"))


def downgrade():
    op.drop_column("wettkampf", "ranking_mode")
