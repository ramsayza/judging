import enum
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Date, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.event_class import EventClass


class EventStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    completed = "completed"
    cancelled = "cancelled"
    archived = "archived"


class EventRuleSet(str, enum.Enum):
    rkc = "RKC"
    nexus = "Nexus"
    ifcs = "IFCS"
    a4a = "A4A"
    independent = "Independent"


class Event(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "events"
    __table_args__ = (Index("ix_event_org_start_date", "organization_id", "start_date"),)

    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    venue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    venue_postcode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    rule_set: Mapped[EventRuleSet | None] = mapped_column(
        # EventRuleSet is the one enum here whose member .name ("rkc") differs
        # from its .value ("RKC") -- SQLAlchemy's Enum defaults to persisting
        # .name, but the DB column and the JSON API both use .value, so this
        # must be told explicitly to round-trip on .value instead.
        Enum(EventRuleSet, values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
    )
    cost_per_mile: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default="0.55")
    reimbursement_cap: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus), nullable=False, default=EventStatus.draft)
    created_by_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    contract_requirement_fields: Mapped[list | None] = mapped_column(JSON, nullable=True)
    contract_copy_override: Mapped[str | None] = mapped_column(Text, nullable=True)

    classes: Mapped[list["EventClass"]] = relationship(back_populates="event")
