from pydantic import BaseModel, ConfigDict


class ClassAllocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contract_id: str
    event_class_id: str


class ClassAllocationCreate(BaseModel):
    event_class_id: str


class AllocationBoardEntry(BaseModel):
    allocation_id: str
    event_class_id: str
    event_class_name: str
    ring: str | None
    contract_id: str
    judge_user_id: str
    judge_name: str
    contract_status: str


class RingAllocationCreate(BaseModel):
    ring: str
