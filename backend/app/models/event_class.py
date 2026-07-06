from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.class_allocation import ClassAllocation
    from app.models.event import Event


class EventClass(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "event_classes"
    __table_args__ = (Index("ix_event_class_event", "event_id"),)

    event_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("events.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    discipline: Mapped[str | None] = mapped_column(String(100), nullable=True)
    scheduled_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ring: Mapped[str | None] = mapped_column(String(100), nullable=True)

    event: Mapped["Event"] = relationship(back_populates="classes")
    allocations: Mapped[list["ClassAllocation"]] = relationship(back_populates="event_class")
