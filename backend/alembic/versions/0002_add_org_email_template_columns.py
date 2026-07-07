"""add organization invitation email template columns

Revision ID: 0002_org_email_template
Revises: 0001_initial
Create Date: 2026-07-07 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_org_email_template"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations", sa.Column("invitation_email_subject", sa.String(length=255), nullable=True)
    )
    op.add_column("organizations", sa.Column("invitation_email_body", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "invitation_email_body")
    op.drop_column("organizations", "invitation_email_subject")
