"""add haeuser and haus_members tables

Revision ID: 012
Revises: 011
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "haeuser",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(20), nullable=False, server_default="#6366f1"),
        sa.Column("logo_path", sa.Text(), nullable=True),
    )
    op.create_table(
        "haus_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("haus_id", sa.Integer(), sa.ForeignKey("haeuser.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("haus_id", "class_id", name="uq_haus_class"),
    )


def downgrade():
    op.drop_table("haus_members")
    op.drop_table("haeuser")
