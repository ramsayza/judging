"""add user rule_set_qualifications column

Revision ID: 0007_rule_set_qualifications
Revises: 0006_event_reimbursement
Create Date: 2026-07-07 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0007_rule_set_qualifications"
down_revision: Union[str, None] = "0006_event_reimbursement"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("rule_set_qualifications", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "rule_set_qualifications")
