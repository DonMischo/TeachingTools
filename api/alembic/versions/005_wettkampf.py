"""add wettkampf tables

Revision ID: 005
Revises: 004
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "wettkampf",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("max_points", sa.Integer, nullable=False, server_default="10"),
        sa.Column("trostpreis_points", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "wettkampf_stage",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("wettkampf_id", sa.Integer, sa.ForeignKey("wettkampf.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("order", sa.Integer, nullable=False),
        sa.Column("points", sa.Integer, nullable=False),
    )

    op.create_table(
        "wettkampf_teilnehmer",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("wettkampf_id", sa.Integer, sa.ForeignKey("wettkampf.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("seed", sa.Integer, nullable=True),
        sa.Column("group", sa.String(100), nullable=True),
        sa.Column("class_id", sa.Integer, sa.ForeignKey("classes.id", ondelete="SET NULL"), nullable=True),
    )

    op.create_table(
        "wettkampf_match",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("wettkampf_id", sa.Integer, sa.ForeignKey("wettkampf.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage_id", sa.Integer, sa.ForeignKey("wettkampf_stage.id", ondelete="SET NULL"), nullable=True),
        sa.Column("round_number", sa.Integer, nullable=False),
        sa.Column("match_number", sa.Integer, nullable=False),
        sa.Column("p1_id", sa.Integer, sa.ForeignKey("wettkampf_teilnehmer.id", ondelete="SET NULL"), nullable=True),
        sa.Column("p2_id", sa.Integer, sa.ForeignKey("wettkampf_teilnehmer.id", ondelete="SET NULL"), nullable=True),
        sa.Column("winner_id", sa.Integer, sa.ForeignKey("wettkampf_teilnehmer.id", ondelete="SET NULL"), nullable=True),
        sa.Column("score_p1", sa.String(20), nullable=True),
        sa.Column("score_p2", sa.String(20), nullable=True),
    )


def downgrade():
    op.drop_table("wettkampf_match")
    op.drop_table("wettkampf_teilnehmer")
    op.drop_table("wettkampf_stage")
    op.drop_table("wettkampf")
