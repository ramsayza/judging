import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class MembershipRole(str, enum.Enum):
    judge = "judge"
    organizer = "organizer"
    admin = "admin"


class MembershipStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    removed = "removed"


class Membership(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),
        Index("ix_membership_org_role", "organization_id", "role"),
    )

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    role: Mapped[MembershipRole] = mapped_column(Enum(MembershipRole), nullable=False)
    status: Mapped[MembershipStatus] = mapped_column(
        Enum(MembershipStatus), nullable=False, default=MembershipStatus.pending
    )
    invited_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="memberships", foreign_keys=[user_id])
    organization: Mapped["Organization"] = relationship(back_populates="memberships")
