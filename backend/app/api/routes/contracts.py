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
from app.models.organization import Organization
from app.schemas.contract import ContractAcceptRequest, ContractActionRequest, ContractCreate, ContractRead
from app.schemas.event import RequirementField
from app.services.contract_service import apply_action
from app.services.email_service import send_judge_invitation_email
from app.services.requirement_service import validate_responses
from app.services.user_service import get_or_create_judge

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

    org = db.get(Organization, org_id)

    # Judges are global (one User per email, not per org) -- if this is the
    # first time this club has dealt with them, create the account now rather
    # than requiring them to sign up first.
    judge, _judge_created = get_or_create_judge(
        db, email=payload.judge_email, name=payload.judge_name or payload.judge_email
    )

    judge_membership = (
        db.query(Membership)
        .filter(Membership.user_id == judge.id, Membership.organization_id == org_id)
        .one_or_none()
    )
    if judge_membership is None:
        judge_membership = Membership(
            user_id=judge.id,
            organization_id=org_id,
            role=MembershipRole.judge,
            status=MembershipStatus.active,
        )
        db.add(judge_membership)

    contract = Contract(
        event_id=event_id,
        judge_user_id=judge.id,
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

    send_judge_invitation_email(
        to_email=judge.email,
        judge_name=judge.name,
        organization_name=org.name,
        event_name=event.name,
        event_start_date=event.start_date,
        event_end_date=event.end_date,
        contract_id=contract.id,
        subject_template=org.invitation_email_subject,
        body_template=org.invitation_email_body,
    )

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
    payload: ContractAcceptRequest,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> Contract:
    contract = _get_contract_or_404(db, org_id, contract_id)
    if contract.judge_user_id != membership.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only the invited judge can perform this action")

    event = db.get(Event, contract.event_id)
    fields = [RequirementField(**f) for f in (event.contract_requirement_fields or [])]
    try:
        normalized_responses = validate_responses(fields, payload.responses)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    # Responses are captured exactly once, right here -- there is no route
    # anywhere that updates requirement_responses after this, so this is the
    # only write these answers ever get.
    contract.requirement_responses = normalized_responses
    try:
        return apply_action(db, contract, "accept", membership.user_id, reason=None)
    except ContractTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


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
