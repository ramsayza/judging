import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.membership import Membership


class JoinPolicy(str, enum.Enum):
    open = "open"
    approval = "approval"


class Organization(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    join_policy: Mapped[JoinPolicy] = mapped_column(
        Enum(JoinPolicy), nullable=False, default=JoinPolicy.approval
    )
    invitation_email_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invitation_email_body: Mapped[str | None] = mapped_column(Text, nullable=True)

    memberships: Mapped[list["Membership"]] = relationship(back_populates="organization")
