"""add event venue_postcode, rule_set, and archived status

Revision ID: 0005_event_venue_rule_set
Revises: 0004_user_judge_profile
Create Date: 2026-07-07 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0005_event_venue_rule_set"
down_revision: Union[str, None] = "0004_user_judge_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("venue_postcode", sa.String(length=20), nullable=True))
    op.add_column(
        "events",
        sa.Column(
            "rule_set",
            sa.Enum("RKC", "Nexus", "IFCS", "A4A", "Independent", name="eventruleset"),
            nullable=True,
        ),
    )
    op.alter_column(
        "events",
        "status",
        existing_type=sa.Enum("draft", "published", "completed", "cancelled", name="eventstatus"),
        type_=sa.Enum("draft", "published", "completed", "cancelled", "archived", name="eventstatus"),
        existing_nullable=False,
        existing_server_default="draft",
    )


def downgrade() -> None:
    op.alter_column(
        "events",
        "status",
        existing_type=sa.Enum("draft", "published", "completed", "cancelled", "archived", name="eventstatus"),
        type_=sa.Enum("draft", "published", "completed", "cancelled", name="eventstatus"),
        existing_nullable=False,
        existing_server_default="draft",
    )
    op.drop_column("events", "rule_set")
    op.drop_column("events", "venue_postcode")
