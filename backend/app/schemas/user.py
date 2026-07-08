from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.event import EventRuleSet


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    avatar_url: str | None = None
    is_platform_admin: bool = False


class ClassRestriction(BaseModel):
    discipline: str | None = None
    level: str | None = None

    @model_validator(mode="after")
    def _check_not_empty(self) -> "ClassRestriction":
        if not self.discipline and not self.level:
            raise ValueError("a restriction needs at least a discipline or a level")
        return self


class RuleSetQualification(BaseModel):
    rule_set: EventRuleSet
    qualified_date: date


class UserDetailsRead(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None
    is_platform_admin: bool
    home_postcode: str | None
    class_restrictions: list[ClassRestriction]
    rule_set_qualifications: list[RuleSetQualification]


class UserDetailsUpdate(BaseModel):
    home_postcode: str | None = None
    class_restrictions: list[ClassRestriction] = []
    rule_set_qualifications: list[RuleSetQualification] = []

    @model_validator(mode="after")
    def _check_unique_rule_sets(self) -> "UserDetailsUpdate":
        rule_sets = [q.rule_set for q in self.rule_set_qualifications]
        if len(rule_sets) != len(set(rule_sets)):
            raise ValueError("each rule set can only have one qualification date")
        return self


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
