"""add platform admin, shrink membership role enum (drop admin), rule set
contract copies, event/contract contract-copy columns

Revision ID: 0008_admin_contract_copy
Revises: 0007_rule_set_qualifications
Create Date: 2026-07-08 00:00:00

"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0008_admin_contract_copy"
down_revision: Union[str, None] = "0007_rule_set_qualifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RULE_SET_COPIES_TABLE = sa.table(
    "rule_set_contract_copies",
    sa.column("rule_set", sa.String),
    sa.column("body", sa.String),
    sa.column("created_at", sa.DateTime),
    sa.column("updated_at", sa.DateTime),
)


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("is_platform_admin", sa.Boolean(), nullable=False, server_default="0")
    )

    # Existing org-admins become that org's organizer -- organizer is now the
    # highest-privileged role within an org, admin no longer exists at the
    # Membership level at all. This must run *before* the enum is shrunk,
    # since the column would otherwise still contain the value being removed.
    op.execute("UPDATE memberships SET role = 'organizer' WHERE role = 'admin'")
    op.alter_column(
        "memberships",
        "role",
        existing_type=sa.Enum("judge", "organizer", "admin", name="membershiprole"),
        type_=sa.Enum("judge", "organizer", name="membershiprole"),
        existing_nullable=False,
    )

    op.create_table(
        "rule_set_contract_copies",
        sa.Column(
            "rule_set",
            sa.Enum("RKC", "Nexus", "IFCS", "A4A", "Independent", name="eventruleset"),
            primary_key=True,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    now = datetime.utcnow()
    op.bulk_insert(
        RULE_SET_COPIES_TABLE,
        [
            {"rule_set": rs, "body": "", "created_at": now, "updated_at": now}
            for rs in ("RKC", "Nexus", "IFCS", "A4A", "Independent")
        ],
    )

    op.add_column("events", sa.Column("contract_copy_override", sa.Text(), nullable=True))
    op.add_column("contracts", sa.Column("contract_copy_signed_at", sa.DateTime(), nullable=True))
    op.add_column("contracts", sa.Column("contract_copy_signed_body", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("contracts", "contract_copy_signed_body")
    op.drop_column("contracts", "contract_copy_signed_at")
    op.drop_column("events", "contract_copy_override")
    op.drop_table("rule_set_contract_copies")
    op.alter_column(
        "memberships",
        "role",
        existing_type=sa.Enum("judge", "organizer", name="membershiprole"),
        type_=sa.Enum("judge", "organizer", "admin", name="membershiprole"),
        existing_nullable=False,
    )
    op.drop_column("users", "is_platform_admin")
