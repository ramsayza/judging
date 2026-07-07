"""add user judge profile columns

Revision ID: 0004_user_judge_profile
Revises: 0003_contract_requirements
Create Date: 2026-07-07 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0004_user_judge_profile"
down_revision: Union[str, None] = "0003_contract_requirements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("home_postcode", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("class_restrictions", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "class_restrictions")
    op.drop_column("users", "home_postcode")
