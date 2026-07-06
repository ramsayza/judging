from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership, require_role
from app.core.state_machine import ContractTransitionError
from app.db import get_db
from app.models.contract import Contract, ContractStatus
from app.models.event import Event
from app.models.membership import Membership, MembershipRole, MembershipStatus
from app.schemas.contract import ContractActionRequest, ContractCreate, ContractRead
from app.services.contract_service import apply_action

router = APIRouter(tags=["contracts"])


@router.post(
    "/organizations/{org_id}/events/{event_id}/contracts",
    response_model=ContractRead,
    status_code=status.HTTP_201_CREATED,
)
def create_contract(
    org_id: str,
    event_id: str,
    payload: ContractCreate,
    db: Session = Depends(get_db),
    membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> Contract:
    event = db.query(Event).filter(Event.id == event_id, Event.organization_id == org_id).one_or_none()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "event not found")

    judge_membership = (
        db.query(Membership)
        .filter(
            Membership.user_id == payload.judge_user_id,
            Membership.organization_id == org_id,
            Membership.status == MembershipStatus.active,
        )
        .one_or_none()
    )
    if judge_membership is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "judge must have an active membership in this organization"
        )

    contract = Contract(
        event_id=event_id,
        judge_user_id=payload.judge_user_id,
        organization_id=org_id,
        invited_by_user_id=membership.user_id,
        invited_at=datetime.utcnow(),
    )
    db.add(contract)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "this judge already has a contract for this event"
        ) from exc
    db.refresh(contract)
    return contract


@router.get("/organizations/{org_id}/contracts", response_model=list[ContractRead])
def list_contracts(
    org_id: str,
    event_id: str | None = Query(default=None),
    status_filter: ContractStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> list[Contract]:
    query = db.query(Contract).filter(Contract.organization_id == org_id)
    if membership.role == MembershipRole.judge:
        query = query.filter(Contract.judge_user_id == membership.user_id)
    if event_id is not None:
        query = query.filter(Contract.event_id == event_id)
    if status_filter is not None:
        query = query.filter(Contract.status == status_filter)
    return query.order_by(Contract.invited_at.desc()).all()


@router.get("/organizations/{org_id}/contracts/{contract_id}", response_model=ContractRead)
def get_contract(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> Contract:
    contract = _get_contract_or_404(db, org_id, contract_id)
    if membership.role == MembershipRole.judge and contract.judge_user_id != membership.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")
    return contract


@router.post("/organizations/{org_id}/contracts/{contract_id}/accept", response_model=ContractRead)
def accept_contract(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> Contract:
    return _perform_judge_action(db, org_id, contract_id, "accept", membership, reason=None)


@router.post("/organizations/{org_id}/contracts/{contract_id}/decline", response_model=ContractRead)
def decline_contract(
    org_id: str,
    contract_id: str,
    payload: ContractActionRequest,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> Contract:
    return _perform_judge_action(db, org_id, contract_id, "decline", membership, reason=payload.reason)


@router.post("/organizations/{org_id}/contracts/{contract_id}/appoint", response_model=ContractRead)
def appoint_contract(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> Contract:
    return _perform_organizer_action(db, org_id, contract_id, "appoint", membership, reason=None)


@router.post("/organizations/{org_id}/contracts/{contract_id}/complete", response_model=ContractRead)
def complete_contract(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> Contract:
    return _perform_organizer_action(db, org_id, contract_id, "complete", membership, reason=None)


@router.post("/organizations/{org_id}/contracts/{contract_id}/cancel", response_model=ContractRead)
def cancel_contract(
    org_id: str,
    contract_id: str,
    payload: ContractActionRequest,
    db: Session = Depends(get_db),
    membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> Contract:
    return _perform_organizer_action(db, org_id, contract_id, "cancel", membership, reason=payload.reason)


def _perform_judge_action(
    db: Session, org_id: str, contract_id: str, action: str, membership: Membership, reason: str | None
) -> Contract:
    contract = _get_contract_or_404(db, org_id, contract_id)
    if contract.judge_user_id != membership.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only the invited judge can perform this action")
    try:
        return apply_action(db, contract, action, membership.user_id, reason=reason)
    except ContractTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


def _perform_organizer_action(
    db: Session, org_id: str, contract_id: str, action: str, membership: Membership, reason: str | None
) -> Contract:
    contract = _get_contract_or_404(db, org_id, contract_id)
    try:
        return apply_action(db, contract, action, membership.user_id, reason=reason)
    except ContractTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


def _get_contract_or_404(db: Session, org_id: str, contract_id: str) -> Contract:
    contract = (
        db.query(Contract)
        .filter(Contract.id == contract_id, Contract.organization_id == org_id)
        .one_or_none()
    )
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")
    return contract
