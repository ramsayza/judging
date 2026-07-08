from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership, require_role
from app.db import get_db
from app.models.class_allocation import ClassAllocation
from app.models.event import Event
from app.models.event_class import EventClass
from app.models.membership import Membership, MembershipRole
from app.schemas.event import EventClassCreate, EventClassRead, EventClassUpdate

router = APIRouter(tags=["classes"])


@router.post(
    "/organizations/{org_id}/events/{event_id}/classes",
    response_model=EventClassRead,
    status_code=status.HTTP_201_CREATED,
)
def create_class(
    org_id: str,
    event_id: str,
    payload: EventClassCreate,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> EventClass:
    _get_org_event_or_404(db, org_id, event_id)
    next_number = (
        db.query(func.max(EventClass.class_number)).filter(EventClass.event_id == event_id).scalar() or 0
    ) + 1
    event_class = EventClass(event_id=event_id, class_number=next_number, **payload.model_dump())
    db.add(event_class)
    db.commit()
    db.refresh(event_class)
    return event_class


@router.get("/organizations/{org_id}/events/{event_id}/classes", response_model=list[EventClassRead])
def list_classes(
    org_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(get_current_membership),
) -> list[EventClass]:
    _get_org_event_or_404(db, org_id, event_id)
    return db.query(EventClass).filter(EventClass.event_id == event_id).all()


@router.patch(
    "/organizations/{org_id}/events/{event_id}/classes/{class_id}",
    response_model=EventClassRead,
)
def update_class(
    org_id: str,
    event_id: str,
    class_id: str,
    payload: EventClassUpdate,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> EventClass:
    _get_org_event_or_404(db, org_id, event_id)
    event_class = _get_event_class_or_404(db, event_id, class_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event_class, field, value)
    db.commit()
    db.refresh(event_class)
    return event_class


@router.delete(
    "/organizations/{org_id}/events/{event_id}/classes/{class_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_class(
    org_id: str,
    event_id: str,
    class_id: str,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> None:
    _get_org_event_or_404(db, org_id, event_id)
    event_class = _get_event_class_or_404(db, event_id, class_id)
    has_allocation = (
        db.query(ClassAllocation).filter(ClassAllocation.event_class_id == class_id).first()
    )
    if has_allocation is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "cannot delete a class with existing allocations")
    db.delete(event_class)
    db.commit()


def _get_org_event_or_404(db: Session, org_id: str, event_id: str) -> Event:
    event = db.query(Event).filter(Event.id == event_id, Event.organization_id == org_id).one_or_none()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "event not found")
    return event


def _get_event_class_or_404(db: Session, event_id: str, class_id: str) -> EventClass:
    event_class = (
        db.query(EventClass).filter(EventClass.id == class_id, EventClass.event_id == event_id).one_or_none()
    )
    if event_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "class not found")
    return event_class
