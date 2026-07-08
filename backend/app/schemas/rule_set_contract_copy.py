from pydantic import BaseModel, ConfigDict

from app.models.event import EventRuleSet


class RuleSetContractCopyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rule_set: EventRuleSet
    body: str


class RuleSetContractCopyUpdate(BaseModel):
    body: str
