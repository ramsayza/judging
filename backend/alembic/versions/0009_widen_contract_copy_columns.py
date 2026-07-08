"""widen rule_set_contract_copies.body, events.contract_copy_override, and
contracts.contract_copy_signed_body from TEXT (65,535-byte cap) to LONGTEXT

Revision ID: 0009_widen_contract_copy
Revises: 0008_admin_contract_copy
Create Date: 2026-07-08 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "0009_widen_contract_copy"
down_revision: Union[str, None] = "0008_admin_contract_copy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "rule_set_contract_copies",
        "body",
        existing_type=sa.Text(),
        type_=mysql.LONGTEXT(),
        existing_nullable=False,
    )
    op.alter_column(
        "events",
        "contract_copy_override",
        existing_type=sa.Text(),
        type_=mysql.LONGTEXT(),
        existing_nullable=True,
    )
    op.alter_column(
        "contracts",
        "contract_copy_signed_body",
        existing_type=sa.Text(),
        type_=mysql.LONGTEXT(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "contracts",
        "contract_copy_signed_body",
        existing_type=mysql.LONGTEXT(),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "events",
        "contract_copy_override",
        existing_type=mysql.LONGTEXT(),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "rule_set_contract_copies",
        "body",
        existing_type=mysql.LONGTEXT(),
        type_=sa.Text(),
        existing_nullable=False,
    )
