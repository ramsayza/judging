from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    avatar_url: str | None = None


class ClassRestriction(BaseModel):
    discipline: str | None = None
    level: str | None = None

    @model_validator(mode="after")
    def _check_not_empty(self) -> "ClassRestriction":
        if not self.discipline and not self.level:
            raise ValueError("a restriction needs at least a discipline or a level")
        return self


class UserDetailsRead(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None
    home_postcode: str | None
    class_restrictions: list[ClassRestriction]


class UserDetailsUpdate(BaseModel):
    home_postcode: str | None = None
    class_restrictions: list[ClassRestriction] = []


class ClassRestrictionOptions(BaseModel):
    disciplines: list[str]
    levels: list[str]


class UserUpsertRequest(BaseModel):
    email: str
    name: str
    avatar_url: str | None = None
    provider: Literal["google", "facebook"]
    provider_sub: str


class UserUpsertResponse(BaseModel):
    user_id: str


class DevLoginRequest(BaseModel):
    email: str
    name: str = "Dev User"


class DevLoginResponse(BaseModel):
    user_id: str
    api_token: str
