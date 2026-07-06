from datetime import datetime

from sqlalchemy.orm import Session

from app.core.state_machine import validate_transition
from app.models.class_allocation import ClassAllocation
from app.models.contract import Contract


def apply_action(
    db: Session, contract: Contract, action: str, actor_user_id: str, reason: str | None = None
) -> Contract:
    spec = validate_transition(contract.status, contract.judge_user_id, action, actor_user_id)

    now = datetime.utcnow()
    contract.status = spec.to_status

    if action == "accept":
        contract.responded_at = now
    elif action == "decline":
        contract.responded_at = now
        contract.decline_reason = reason
    elif action == "appoint":
        contract.appointed_at = now
    elif action == "complete":
        contract.completed_at = now
    elif action == "cancel":
        contract.cancelled_at = now
        contract.cancel_reason = reason
        # Free up the classes for reassignment to another judge.
        db.query(ClassAllocation).filter(ClassAllocation.contract_id == contract.id).delete(
            synchronize_session=False
        )

    db.commit()
    db.refresh(contract)
    return contract
