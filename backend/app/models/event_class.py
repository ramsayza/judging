from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Index, Integer, String
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
    class_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    discipline: Mapped[str | None] = mapped_column(String(100), nullable=True)
    class_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    ring: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ring_position: Mapped[int | None] = mapped_column(Integer, nullable=True)

    event: Mapped["Event"] = relationship(back_populates="classes")
    allocations: Mapped[list["ClassAllocation"]] = relationship(back_populates="event_class")
