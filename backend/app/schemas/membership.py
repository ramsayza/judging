from pydantic import BaseModel, ConfigDict

from app.models.membership import MembershipRole, MembershipStatus


class MembershipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    organization_id: str
    role: MembershipRole
    status: MembershipStatus


class MembershipWithOrgRead(MembershipRead):
    organization_name: str
    organization_slug: str


class MembershipWithUserRead(MembershipRead):
    user_email: str
    user_name: str


class MembershipUpdate(BaseModel):
    role: MembershipRole | None = None
    status: MembershipStatus | None = None


class JoinOrganizationRequest(BaseModel):
    pass
