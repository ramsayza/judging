from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db import get_db
from app.models.membership import Membership, MembershipRole, MembershipStatus
from app.models.user import User
from app.schemas.membership import MembershipUpdate, MembershipWithUserRead

router = APIRouter(tags=["memberships"])


def _serialize(membership: Membership, user: User) -> MembershipWithUserRead:
    return MembershipWithUserRead(
        id=membership.id,
        user_id=membership.user_id,
        organization_id=membership.organization_id,
        role=membership.role,
        status=membership.status,
        user_email=user.email,
        user_name=user.name,
    )


@router.get("/organizations/{org_id}/memberships", response_model=list[MembershipWithUserRead])
def list_memberships(
    org_id: str,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> list[MembershipWithUserRead]:
    rows = (
        db.query(Membership, User)
        .join(User, Membership.user_id == User.id)
        .filter(Membership.organization_id == org_id)
        .all()
    )
    return [_serialize(m, u) for m, u in rows]


@router.get("/organizations/{org_id}/memberships/pending", response_model=list[MembershipWithUserRead])
def list_pending_memberships(
    org_id: str,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> list[MembershipWithUserRead]:
    rows = (
        db.query(Membership, User)
        .join(User, Membership.user_id == User.id)
        .filter(Membership.organization_id == org_id, Membership.status == MembershipStatus.pending)
        .all()
    )
    return [_serialize(m, u) for m, u in rows]


@router.patch("/organizations/{org_id}/memberships/{membership_id}", response_model=MembershipWithUserRead)
def update_membership(
    org_id: str,
    membership_id: str,
    payload: MembershipUpdate,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.organizer)),
) -> MembershipWithUserRead:
    target = (
        db.query(Membership)
        .filter(Membership.id == membership_id, Membership.organization_id == org_id)
        .one_or_none()
    )
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "membership not found")

    # organizer is now the org's highest-privileged role -- every org needs
    # at least one active organizer, same safety check that used to protect
    # the last org-admin.
    would_remove_organizer = target.role == MembershipRole.organizer and (
        (payload.role is not None and payload.role != MembershipRole.organizer)
        or (payload.status is not None and payload.status != MembershipStatus.active)
    )
    if would_remove_organizer:
        other_active_organizers = (
            db.query(Membership)
            .filter(
                Membership.organization_id == org_id,
                Membership.role == MembershipRole.organizer,
                Membership.status == MembershipStatus.active,
                Membership.id != target.id,
            )
            .count()
        )
        if other_active_organizers == 0:
            raise HTTPException(status.HTTP_409_CONFLICT, "cannot demote or remove the last active organizer")

    if payload.role is not None:
        target.role = payload.role
    if payload.status is not None:
        target.status = payload.status

    db.commit()
    db.refresh(target)
    user = db.get(User, target.user_id)
    return _serialize(target, user)
