"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-06 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("avatar_url", sa.String(length=1024), nullable=True),
        sa.Column("google_sub", sa.String(length=255), nullable=True),
        sa.Column("facebook_sub", sa.String(length=255), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("google_sub", name="uq_users_google_sub"),
        sa.UniqueConstraint("facebook_sub", name="uq_users_facebook_sub"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "organizations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column(
            "join_policy",
            sa.Enum("open", "approval", name="joinpolicy"),
            nullable=False,
            server_default="approval",
        ),
        sa.UniqueConstraint("slug", name="uq_organizations_slug"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"])

    op.create_table(
        "memberships",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "organization_id",
            sa.String(length=36),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("role", sa.Enum("judge", "organizer", "admin", name="membershiprole"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "active", "removed", name="membershipstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "invited_by_user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),
    )
    op.create_index("ix_membership_user", "memberships", ["user_id"])
    op.create_index("ix_membership_org", "memberships", ["organization_id"])
    op.create_index("ix_membership_org_role", "memberships", ["organization_id", "role"])

    op.create_table(
        "events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column(
            "organization_id",
            sa.String(length=36),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("venue", sa.String(length=255), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "published", "completed", "cancelled", name="eventstatus"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "created_by_user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
    )
    op.create_index("ix_event_org_start_date", "events", ["organization_id", "start_date"])

    op.create_table(
        "event_classes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("event_id", sa.String(length=36), sa.ForeignKey("events.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("level", sa.String(length=100), nullable=True),
        sa.Column("discipline", sa.String(length=100), nullable=True),
        sa.Column("scheduled_time", sa.DateTime(), nullable=True),
        sa.Column("ring", sa.String(length=100), nullable=True),
    )
    op.create_index("ix_event_class_event", "event_classes", ["event_id"])

    op.create_table(
        "contracts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("event_id", sa.String(length=36), sa.ForeignKey("events.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "judge_user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column(
            "organization_id",
            sa.String(length=36),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "invitation", "accepted", "declined", "appointed", "cancelled", "complete", name="contractstatus"
            ),
            nullable=False,
            server_default="invitation",
        ),
        sa.Column(
            "invited_by_user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("invited_at", sa.DateTime(), nullable=False),
        sa.Column("responded_at", sa.DateTime(), nullable=True),
        sa.Column("appointed_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("decline_reason", sa.Text(), nullable=True),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("event_id", "judge_user_id", name="uq_contract_event_judge"),
    )
    op.create_index("ix_contract_org_status", "contracts", ["organization_id", "status"])
    op.create_index("ix_contract_judge_status", "contracts", ["judge_user_id", "status"])

    op.create_table(
        "class_allocations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column(
            "contract_id", sa.String(length=36), sa.ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column(
            "event_class_id",
            sa.String(length=36),
            sa.ForeignKey("event_classes.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.UniqueConstraint("contract_id", "event_class_id", name="uq_allocation_contract_class"),
    )
    op.create_index("ix_allocation_contract", "class_allocations", ["contract_id"])


def downgrade() -> None:
    op.drop_table("class_allocations")
    op.drop_table("contracts")
    op.drop_table("event_classes")
    op.drop_table("events")
    op.drop_table("memberships")
    op.drop_table("organizations")
    op.drop_table("users")
