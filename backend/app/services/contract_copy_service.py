from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.rule_set_contract_copy import RuleSetContractCopy


def get_effective_contract_copy(db: Session, event: Event) -> str:
    """The event's own override wins; otherwise fall back to the platform
    admin's global sample copy for the event's rule set; otherwise there's
    nothing to sign."""
    if event.contract_copy_override:
        return event.contract_copy_override
    if event.rule_set is not None:
        copy = db.get(RuleSetContractCopy, event.rule_set)
        if copy is not None:
            return copy.body
    return ""
