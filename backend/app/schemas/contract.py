from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.contract import ContractStatus


class ContractRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    judge_user_id: str
    organization_id: str
    status: ContractStatus
    invited_by_user_id: str
    invited_at: datetime
    responded_at: datetime | None
    appointed_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    decline_reason: str | None
    cancel_reason: str | None
    notes: str | None


class ContractCreate(BaseModel):
    judge_email: str
    judge_name: str | None = None


class ContractActionRequest(BaseModel):
    reason: str | None = None
