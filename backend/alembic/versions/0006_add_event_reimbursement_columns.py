"""add event cost_per_mile/reimbursement_cap and contract reimbursement_estimate

Revision ID: 0006_event_reimbursement
Revises: 0005_event_venue_rule_set
Create Date: 2026-07-07 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0006_event_reimbursement"
down_revision: Union[str, None] = "0005_event_venue_rule_set"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "events", sa.Column("cost_per_mile", sa.Numeric(5, 2), nullable=False, server_default="0.55")
    )
    op.add_column("events", sa.Column("reimbursement_cap", sa.Numeric(8, 2), nullable=True))
    op.add_column("contracts", sa.Column("reimbursement_estimate", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("contracts", "reimbursement_estimate")
    op.drop_column("events", "reimbursement_cap")
    op.drop_column("events", "cost_per_mile")
