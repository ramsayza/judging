from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership, require_role
from app.db import get_db
from app.models.contract import Contract, ContractStatus
from app.models.event import Event
from app.models.membership import Membership, MembershipRole
from app.schemas.event import EventCreate, EventRead, EventUpdate

router = APIRouter(tags=["events"])


@router.post(
    "/organizations/{org_id}/events",
    response_model=EventRead,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    org_id: str,
    payload: EventCreate,
    db: Session = Depends(get_db),
    membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> Event:
    event = Event(
        organization_id=org_id,
        name=payload.name,
        venue=payload.venue,
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_by_user_id=membership.user_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/organizations/{org_id}/events", response_model=list[EventRead])
def list_events(
    org_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> list[Event]:
    query = db.query(Event).filter(Event.organization_id == org_id)
    if membership.role == MembershipRole.judge:
        query = query.join(Contract, Contract.event_id == Event.id).filter(
            Contract.judge_user_id == membership.user_id
        )
    return query.order_by(Event.start_date).all()


@router.get("/organizations/{org_id}/events/{event_id}", response_model=EventRead)
def get_event(
    org_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    membership: Membership = Depends(get_current_membership),
) -> Event:
    event = _get_org_event_or_404(db, org_id, event_id)
    if membership.role == MembershipRole.judge:
        has_contract = (
            db.query(Contract)
            .filter(Contract.event_id == event_id, Contract.judge_user_id == membership.user_id)
            .first()
        )
        if has_contract is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "event not found")
    return event


@router.patch("/organizations/{org_id}/events/{event_id}", response_model=EventRead)
def update_event(
    org_id: str,
    event_id: str,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> Event:
    event = _get_org_event_or_404(db, org_id, event_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/organizations/{org_id}/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    org_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.admin)),
) -> None:
    event = _get_org_event_or_404(db, org_id, event_id)
    active_contract = (
        db.query(Contract)
        .filter(Contract.event_id == event_id, Contract.status != ContractStatus.cancelled)
        .first()
    )
    if active_contract is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "cannot delete an event with non-cancelled contracts"
        )
    db.delete(event)
    db.commit()


def _get_org_event_or_404(db: Session, org_id: str, event_id: str) -> Event:
    event = db.query(Event).filter(Event.id == event_id, Event.organization_id == org_id).one_or_none()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "event not found")
    return event
