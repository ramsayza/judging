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
from app.models.user import User
from app.schemas.contract import (
    ContractAcceptRequest,
    ContractActionRequest,
    ContractCopyRead,
    ContractCreate,
    ContractRead,
    ReimbursementEstimate,
)
from app.schemas.event import RequirementField
from app.services.contract_copy_service import get_effective_contract_copy
from app.services.contract_service import apply_action
from app.services.email_service import send_judge_invitation_email
from app.services.reimbursement_service import PostcodeLookupError, estimate_reimbursement
from app.services.requirement_service import validate_responses
from app.services.user_service import get_or_create_user_by_email

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
) -> ContractRead:
    event = db.query(Event).filter(Event.id == event_id, Event.organization_id == org_id).one_or_none()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "event not found")
    if not event.contract_requirement_fields:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "set this event's judging requirements before inviting a judge"
        )

    org = db.get(Organization, org_id)

    # Judges are global (one User per email, not per org) -- if this is the
    # first time this club has dealt with them, create the account now rather
    # than requiring them to sign up first.
    judge, _judge_created = get_or_create_user_by_email(
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

    return _to_contract_read(contract, judge)


@router.get("/organizations/{org_id}/contracts", response_model=list[ContractRead])
def list_contracts(
    org_id: str,
    event_id: str | None = Query(default=None),
    status_filter: ContractStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> list[ContractRead]:
    query = (
        db.query(Contract, User)
        .join(User, Contract.judge_user_id == User.id)
        .filter(Contract.organization_id == org_id)
    )
    if membership.role == MembershipRole.judge:
        query = query.filter(Contract.judge_user_id == membership.user_id)
    if event_id is not None:
        query = query.filter(Contract.event_id == event_id)
    if status_filter is not None:
        query = query.filter(Contract.status == status_filter)
    rows = query.order_by(Contract.invited_at.desc()).all()
    return [_to_contract_read(contract, judge) for contract, judge in rows]


@router.get("/organizations/{org_id}/contracts/{contract_id}", response_model=ContractRead)
def get_contract(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> ContractRead:
    contract = _get_contract_or_404(db, org_id, contract_id)
    if membership.role == MembershipRole.judge and contract.judge_user_id != membership.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")
    judge = db.get(User, contract.judge_user_id)
    return _to_contract_read(contract, judge)


@router.get(
    "/organizations/{org_id}/contracts/{contract_id}/reimbursement-estimate",
    response_model=ReimbursementEstimate,
)
def get_reimbursement_estimate(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> ReimbursementEstimate:
    contract = _get_contract_or_404(db, org_id, contract_id)
    if membership.role == MembershipRole.judge and contract.judge_user_id != membership.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")

    judge = db.get(User, contract.judge_user_id)
    event = db.get(Event, contract.event_id)
    if not judge.home_postcode:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "set your home postcode in Your Details to see an expense estimate",
        )
    if not event.venue_postcode:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "this event has no venue postcode set")

    try:
        estimate = estimate_reimbursement(
            judge_postcode=judge.home_postcode,
            venue_postcode=event.venue_postcode,
            cost_per_mile=event.cost_per_mile,
            cap=event.reimbursement_cap,
        )
    except PostcodeLookupError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    return ReimbursementEstimate(**estimate)


@router.get(
    "/organizations/{org_id}/contracts/{contract_id}/contract-copy",
    response_model=ContractCopyRead,
)
def get_contract_copy(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> ContractCopyRead:
    contract = _get_contract_or_404(db, org_id, contract_id)
    if membership.role == MembershipRole.judge and contract.judge_user_id != membership.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")

    event = db.get(Event, contract.event_id)
    return ContractCopyRead(
        effective_body=get_effective_contract_copy(db, event),
        signed_at=contract.contract_copy_signed_at,
        signed_body=contract.contract_copy_signed_body,
    )


@router.post(
    "/organizations/{org_id}/contracts/{contract_id}/sign-contract-copy",
    response_model=ContractRead,
)
def sign_contract_copy(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> ContractRead:
    contract = _get_contract_or_404(db, org_id, contract_id)
    if contract.judge_user_id != membership.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only the invited judge can sign this contract")
    if contract.status != ContractStatus.accepted:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "contract must be accepted before signing the contract copy"
        )
    if contract.contract_copy_signed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "contract copy already signed")

    event = db.get(Event, contract.event_id)
    # Signed exactly once, right here -- no route anywhere edits this
    # afterwards, so this snapshot is what the judge actually agreed to even
    # if the event/global copy text changes later.
    contract.contract_copy_signed_at = datetime.utcnow()
    contract.contract_copy_signed_body = get_effective_contract_copy(db, event)
    db.commit()
    db.refresh(contract)

    judge = db.get(User, contract.judge_user_id)
    return _to_contract_read(contract, judge)


@router.post("/organizations/{org_id}/contracts/{contract_id}/accept", response_model=ContractRead)
def accept_contract(
    org_id: str,
    contract_id: str,
    payload: ContractAcceptRequest,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> ContractRead:
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

    # Reimbursement is supplementary information, not a lifecycle gate -- a
    # missing postcode or an unreachable postcode-lookup service must never
    # block accepting the contract, so failures here are swallowed and just
    # leave reimbursement_estimate unset.
    judge = db.get(User, contract.judge_user_id)
    if judge.home_postcode and event.venue_postcode:
        try:
            contract.reimbursement_estimate = estimate_reimbursement(
                judge_postcode=judge.home_postcode,
                venue_postcode=event.venue_postcode,
                cost_per_mile=event.cost_per_mile,
                cap=event.reimbursement_cap,
            )
        except PostcodeLookupError:
            pass

    try:
        contract = apply_action(db, contract, "accept", membership.user_id, reason=None)
    except ContractTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    return _to_contract_read(contract, judge)


@router.post("/organizations/{org_id}/contracts/{contract_id}/decline", response_model=ContractRead)
def decline_contract(
    org_id: str,
    contract_id: str,
    payload: ContractActionRequest,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> ContractRead:
    return _perform_judge_action(db, org_id, contract_id, "decline", membership, reason=payload.reason)


@router.post("/organizations/{org_id}/contracts/{contract_id}/appoint", response_model=ContractRead)
def appoint_contract(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> ContractRead:
    return _perform_organizer_action(db, org_id, contract_id, "appoint", membership, reason=None)


@router.post("/organizations/{org_id}/contracts/{contract_id}/complete", response_model=ContractRead)
def complete_contract(
    org_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> ContractRead:
    return _perform_organizer_action(db, org_id, contract_id, "complete", membership, reason=None)


@router.post("/organizations/{org_id}/contracts/{contract_id}/cancel", response_model=ContractRead)
def cancel_contract(
    org_id: str,
    contract_id: str,
    payload: ContractActionRequest,
    db: Session = Depends(get_db),
    membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> ContractRead:
    return _perform_organizer_action(db, org_id, contract_id, "cancel", membership, reason=payload.reason)


def _perform_judge_action(
    db: Session, org_id: str, contract_id: str, action: str, membership: Membership, reason: str | None
) -> ContractRead:
    contract = _get_contract_or_404(db, org_id, contract_id)
    if contract.judge_user_id != membership.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only the invited judge can perform this action")
    try:
        contract = apply_action(db, contract, action, membership.user_id, reason=reason)
    except ContractTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    judge = db.get(User, contract.judge_user_id)
    return _to_contract_read(contract, judge)


def _perform_organizer_action(
    db: Session, org_id: str, contract_id: str, action: str, membership: Membership, reason: str | None
) -> ContractRead:
    contract = _get_contract_or_404(db, org_id, contract_id)
    try:
        contract = apply_action(db, contract, action, membership.user_id, reason=reason)
    except ContractTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    judge = db.get(User, contract.judge_user_id)
    return _to_contract_read(contract, judge)


def _to_contract_read(contract: Contract, judge: User) -> ContractRead:
    return ContractRead(
        id=contract.id,
        event_id=contract.event_id,
        judge_user_id=contract.judge_user_id,
        judge_name=judge.name,
        judge_email=judge.email,
        organization_id=contract.organization_id,
        status=contract.status,
        invited_by_user_id=contract.invited_by_user_id,
        invited_at=contract.invited_at,
        responded_at=contract.responded_at,
        appointed_at=contract.appointed_at,
        completed_at=contract.completed_at,
        cancelled_at=contract.cancelled_at,
        decline_reason=contract.decline_reason,
        cancel_reason=contract.cancel_reason,
        notes=contract.notes,
        requirement_responses=contract.requirement_responses,
        reimbursement_estimate=(
            ReimbursementEstimate(**contract.reimbursement_estimate) if contract.reimbursement_estimate else None
        ),
        contract_copy_signed_at=contract.contract_copy_signed_at,
        contract_copy_signed_body=contract.contract_copy_signed_body,
    )


def _get_contract_or_404(db: Session, org_id: str, contract_id: str) -> Contract:
    contract = (
        db.query(Contract)
        .filter(Contract.id == contract_id, Contract.organization_id == org_id)
        .one_or_none()
    )
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")
    return contract
