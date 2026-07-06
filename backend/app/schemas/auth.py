from pydantic import BaseModel

from app.schemas.membership import MembershipWithOrgRead
from app.schemas.user import UserRead


class MeResponse(BaseModel):
    user: UserRead
    memberships: list[MembershipWithOrgRead]
