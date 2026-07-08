from datetime import datetime

from sqlalchemy.orm import Session

from app.core.state_machine import ContractTransitionError, validate_transition
from app.models.class_allocation import ClassAllocation
from app.models.contract import Contract
from app.models.event import Event
from app.services.contract_copy_service import get_effective_contract_copy


def apply_action(
    db: Session, contract: Contract, action: str, actor_user_id: str, reason: str | None = None
) -> Contract:
    spec = validate_transition(contract.status, contract.judge_user_id, action, actor_user_id)

    if action == "appoint" and contract.contract_copy_signed_at is None:
        event = db.get(Event, contract.event_id)
        if get_effective_contract_copy(db, event):
            raise ContractTransitionError("judge must sign the contract copy before being appointed")

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
