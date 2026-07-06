from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.event_class import EventClass


class ClassAllocation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "class_allocations"
    __table_args__ = (
        UniqueConstraint("contract_id", "event_class_id", name="uq_allocation_contract_class"),
        Index("ix_allocation_contract", "contract_id"),
    )

    contract_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=False
    )
    event_class_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("event_classes.id", ondelete="RESTRICT"), nullable=False
    )

    contract: Mapped["Contract"] = relationship(back_populates="allocations")
    event_class: Mapped["EventClass"] = relationship(back_populates="allocations")
