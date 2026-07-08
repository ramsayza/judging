from sqlalchemy import Enum
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TimestampMixin
from app.models.event import EventRuleSet


class RuleSetContractCopy(Base, TimestampMixin):
    """The platform admin's global sample contract copy for each rule set.
    Fixed 5-row table (one per EventRuleSet) -- rule_set is the primary key,
    no separate id needed."""

    __tablename__ = "rule_set_contract_copies"

    rule_set: Mapped[EventRuleSet] = mapped_column(
        Enum(EventRuleSet, values_callable=lambda obj: [e.value for e in obj]), primary_key=True
    )
    body: Mapped[str] = mapped_column(LONGTEXT, nullable=False, default="")
