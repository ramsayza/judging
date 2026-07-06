from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership, get_current_user, require_role
from app.db import get_db
from app.models.membership import Membership, MembershipRole, MembershipStatus
from app.models.organization import JoinPolicy, Organization
from app.models.user import User
from app.schemas.membership import MembershipRead
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationPublicRead,
    OrganizationRead,
    OrganizationUpdate,
)

router = APIRouter(tags=["organizations"])


@router.post("/onboarding/organizations", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Organization:
    org = Organization(name=payload.name, slug=payload.slug)
    db.add(org)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "an organization with this slug already exists") from exc

    db.add(
        Membership(
            user_id=current_user.id,
            organization_id=org.id,
            role=MembershipRole.admin,
            status=MembershipStatus.active,
        )
    )
    db.commit()
    db.refresh(org)
    return org


@router.post(
    "/onboarding/organizations/{org_id}/join",
    response_model=MembershipRead,
    status_code=status.HTTP_201_CREATED,
)
def join_organization(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Membership:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "organization not found")

    existing = (
        db.query(Membership)
        .filter(Membership.user_id == current_user.id, Membership.organization_id == org_id)
        .one_or_none()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "already a member of this organization")

    initial_status = MembershipStatus.active if org.join_policy == JoinPolicy.open else MembershipStatus.pending
    membership = Membership(
        user_id=current_user.id,
        organization_id=org_id,
        role=MembershipRole.judge,
        status=initial_status,
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return membership


@router.get("/organizations", response_model=list[OrganizationPublicRead])
def list_organizations(db: Session = Depends(get_db)) -> list[Organization]:
    return db.query(Organization).order_by(Organization.name).all()


@router.get("/organizations/{org_id}", response_model=OrganizationRead)
def get_organization(
    org_id: str,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(get_current_membership),
) -> Organization:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "organization not found")
    return org


@router.patch("/organizations/{org_id}", response_model=OrganizationRead)
def update_organization(
    org_id: str,
    payload: OrganizationUpdate,
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_role(MembershipRole.admin)),
) -> Organization:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "organization not found")

    if payload.name is not None:
        org.name = payload.name
    if payload.join_policy is not None:
        org.join_policy = payload.join_policy

    db.commit()
    db.refresh(org)
    return org
