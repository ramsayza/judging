from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership, require_role
from app.db import get_db
from app.models.class_allocation import ClassAllocation
from app.models.contract import Contract
from app.models.event import Event
from app.models.event_class import EventClass
from app.models.membership import Membership, MembershipRole
from app.models.user import User
from app.schemas.class_allocation import (
    AllocationBoardEntry,
    ClassAllocationCreate,
    ClassAllocationRead,
)
from app.services.allocation_service import AllocationError, validate_can_allocate, validate_can_deallocate

router = APIRouter(tags=["class_allocations"])


@router.post(
    "/organizations/{org_id}/contracts/{contract_id}/allocations",
    response_model=ClassAllocationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_allocation(
    org_id: str,
    contract_id: str,
    payload: ClassAllocationCreate,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> ClassAllocation:
    contract = (
        db.query(Contract).filter(Contract.id == contract_id, Contract.organization_id == org_id).one_or_none()
    )
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")

    event_class = db.get(EventClass, payload.event_class_id)
    if event_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "class not found")

    try:
        validate_can_allocate(contract, event_class)
    except AllocationError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    allocation = ClassAllocation(contract_id=contract_id, event_class_id=payload.event_class_id)
    db.add(allocation)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "this judge is already allocated to this class"
        ) from exc
    db.refresh(allocation)
    return allocation


@router.delete(
    "/organizations/{org_id}/contracts/{contract_id}/allocations/{allocation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_allocation(
    org_id: str,
    contract_id: str,
    allocation_id: str,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> None:
    contract = (
        db.query(Contract).filter(Contract.id == contract_id, Contract.organization_id == org_id).one_or_none()
    )
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")

    allocation = (
        db.query(ClassAllocation)
        .filter(ClassAllocation.id == allocation_id, ClassAllocation.contract_id == contract_id)
        .one_or_none()
    )
    if allocation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "allocation not found")

    try:
        validate_can_deallocate(contract)
    except AllocationError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    db.delete(allocation)
    db.commit()


@router.get("/organizations/{org_id}/events/{event_id}/allocations", response_model=list[AllocationBoardEntry])
def get_allocation_board(
    org_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(get_current_membership),
) -> list[AllocationBoardEntry]:
    event = db.query(Event).filter(Event.id == event_id, Event.organization_id == org_id).one_or_none()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "event not found")

    rows = (
        db.query(ClassAllocation, EventClass, Contract, User)
        .join(EventClass, ClassAllocation.event_class_id == EventClass.id)
        .join(Contract, ClassAllocation.contract_id == Contract.id)
        .join(User, Contract.judge_user_id == User.id)
        .filter(EventClass.event_id == event_id)
        .all()
    )
    return [
        AllocationBoardEntry(
            allocation_id=allocation.id,
            event_class_id=event_class.id,
            event_class_name=event_class.name,
            contract_id=contract.id,
            judge_user_id=judge.id,
            judge_name=judge.name,
            contract_status=contract.status.value,
        )
        for allocation, event_class, contract, judge in rows
    ]
