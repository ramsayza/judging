from typing import TYPE_CHECKING

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.membership import Membership


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    facebook_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    home_postcode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    class_restrictions: Mapped[list | None] = mapped_column(JSON, nullable=True)

    memberships: Mapped[list["Membership"]] = relationship(
        back_populates="user", foreign_keys="Membership.user_id"
    )
