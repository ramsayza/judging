from typing import Literal

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    avatar_url: str | None = None


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
