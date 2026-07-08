from pydantic import BaseModel, ConfigDict, Field

from app.models.organization import JoinPolicy


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    join_policy: JoinPolicy


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    organizer_email: str
    organizer_name: str | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    join_policy: JoinPolicy | None = None


class OrganizationPublicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str


class OrganizationEmailTemplateRead(BaseModel):
    subject: str | None
    body: str | None
    effective_subject: str
    effective_body: str
    placeholders: list[str]


class OrganizationEmailTemplateUpdate(BaseModel):
    subject: str | None
    body: str | None
