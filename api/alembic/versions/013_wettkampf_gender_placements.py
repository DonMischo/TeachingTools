"""add gender to teilnehmer, rewarded_places to wettkampf, extend ranking_mode

Revision ID: 013
Revises: 012
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("wettkampf_teilnehmer", sa.Column("gender", sa.String(1), nullable=True))
    op.add_column("wettkampf", sa.Column("rewarded_places", sa.Integer(), nullable=True))
    op.alter_column("wettkampf", "ranking_mode", type_=sa.String(50), existing_nullable=False)


def downgrade():
    op.drop_column("wettkampf_teilnehmer", "gender")
    op.drop_column("wettkampf", "rewarded_places")
    op.alter_column("wettkampf", "ranking_mode", type_=sa.String(20), existing_nullable=False)
