"""add contract requirement fields + responses columns

Revision ID: 0003_contract_requirements
Revises: 0002_org_email_template
Create Date: 2026-07-07 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0003_contract_requirements"
down_revision: Union[str, None] = "0002_org_email_template"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("contract_requirement_fields", sa.JSON(), nullable=True))
    op.add_column("contracts", sa.Column("requirement_responses", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("contracts", "requirement_responses")
    op.drop_column("events", "contract_requirement_fields")
