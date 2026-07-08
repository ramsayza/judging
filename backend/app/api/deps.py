from collections.abc import Generator

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import decode_api_token
from app.db import get_db
from app.models.membership import Membership, MembershipRole, MembershipStatus
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

# organizer is the highest-privileged role within an org (there is no more
# in-org "admin" -- that's now a separate, global, non-org-scoped privilege;
# see get_current_platform_admin below). Neither role is implied by the other.
ROLE_IMPLIES: dict[MembershipRole, set[MembershipRole]] = {
    MembershipRole.judge: {MembershipRole.judge},
    MembershipRole.organizer: {MembershipRole.organizer},
}


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    try:
        payload = decode_api_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token") from exc

    user = db.get(User, payload.get("sub"))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found")
    return user


def get_current_platform_admin(current_user: User = Depends(get_current_user)) -> User:
    """Gate for the small set of genuinely global, non-org-scoped admin
    routes (rule-set contract copies, org creation, listing all orgs). This
    is deliberately never mixed into get_current_membership/require_role --
    platform admin grants no automatic access to any individual org's
    members/events/contracts."""
    if not current_user.is_platform_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "platform admin only")
    return current_user


def get_current_membership(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Membership:
    membership = (
        db.query(Membership)
        .filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == org_id,
            Membership.status == MembershipStatus.active,
        )
        .one_or_none()
    )
    if membership is None:
        # 404, not 403 -- avoid leaking whether the org exists or whether the
        # user has a non-active membership to callers who aren't members.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "organization not found")
    return membership


def require_role(*roles: MembershipRole):
    allowed: set[MembershipRole] = set()
    for role in roles:
        allowed |= ROLE_IMPLIES[role]

    def dependency(membership: Membership = Depends(get_current_membership)) -> Membership:
        if membership.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "insufficient role for this action")
        return membership

    return dependency


def verify_internal_secret(x_internal_secret: str | None = Header(default=None)) -> None:
    if x_internal_secret != settings.internal_service_secret:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid internal service secret")
