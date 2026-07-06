from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, verify_internal_secret
from app.config import settings
from app.core.security import create_api_token
from app.db import get_db
from app.models.membership import Membership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import MeResponse
from app.schemas.membership import MembershipWithOrgRead
from app.schemas.user import (
    DevLoginRequest,
    DevLoginResponse,
    UserRead,
    UserUpsertRequest,
    UserUpsertResponse,
)
from app.services.user_service import get_or_create_dev_user, upsert_oauth_user

router = APIRouter(tags=["auth"])


@router.post("/auth/upsert", response_model=UserUpsertResponse, dependencies=[Depends(verify_internal_secret)])
def upsert_user(payload: UserUpsertRequest, db: Session = Depends(get_db)) -> UserUpsertResponse:
    """Server-to-server endpoint called by NextAuth after it has already verified the
    OAuth provider's identity token. Never callable with an end-user bearer token --
    it trusts the caller (Next.js) to have done that verification already."""
    user = upsert_oauth_user(
        db,
        email=payload.email,
        name=payload.name,
        avatar_url=payload.avatar_url,
        provider=payload.provider,
        provider_sub=payload.provider_sub,
    )
    return UserUpsertResponse(user_id=user.id)


@router.post("/auth/dev-login", response_model=DevLoginResponse)
def dev_login(payload: DevLoginRequest, db: Session = Depends(get_db)) -> DevLoginResponse:
    """Dev-only shortcut to obtain a valid API token without going through Google/Facebook.
    Lets local dev and automated smoke tests exercise the API without real OAuth credentials."""
    if settings.environment != "development":
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    user = get_or_create_dev_user(db, email=payload.email, name=payload.name)
    token = create_api_token(user_id=user.id, email=user.email)
    return DevLoginResponse(user_id=user.id, api_token=token)


@router.get("/me", response_model=MeResponse)
def read_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeResponse:
    memberships = (
        db.query(Membership, Organization)
        .join(Organization, Membership.organization_id == Organization.id)
        .filter(Membership.user_id == current_user.id)
        .all()
    )
    return MeResponse(
        user=UserRead.model_validate(current_user),
        memberships=[
            MembershipWithOrgRead(
                id=m.id,
                user_id=m.user_id,
                organization_id=m.organization_id,
                role=m.role,
                status=m.status,
                organization_name=org.name,
                organization_slug=org.slug,
            )
            for m, org in memberships
        ],
    )
