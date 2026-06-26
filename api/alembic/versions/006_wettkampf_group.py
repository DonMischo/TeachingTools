"""add group column to wettkampf_teilnehmer

Revision ID: 006
Revises: 005
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("wettkampf_teilnehmer", sa.Column("group", sa.String(100), nullable=True))


def downgrade():
    op.drop_column("wettkampf_teilnehmer", "group")
