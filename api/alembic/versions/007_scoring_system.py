"""add scoring system fields to wettkampf and is_draw to wettkampf_match

Revision ID: 007
Revises: 006
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("wettkampf", sa.Column("scoring_system", sa.String(20), nullable=False, server_default="soccer"))
    op.add_column("wettkampf", sa.Column("win_points", sa.Integer, nullable=False, server_default="3"))
    op.add_column("wettkampf", sa.Column("draw_points", sa.Integer, nullable=False, server_default="1"))
    op.add_column("wettkampf", sa.Column("loss_points", sa.Integer, nullable=False, server_default="0"))
    op.add_column("wettkampf_match", sa.Column("is_draw", sa.Boolean, nullable=False, server_default="false"))


def downgrade():
    op.drop_column("wettkampf_match", "is_draw")
    op.drop_column("wettkampf", "loss_points")
    op.drop_column("wettkampf", "draw_points")
    op.drop_column("wettkampf", "win_points")
    op.drop_column("wettkampf", "scoring_system")
