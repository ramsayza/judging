import enum
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.event import EventStatus


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    venue: str | None
    start_date: date
    end_date: date
    status: EventStatus
    created_by_user_id: str


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    venue: str | None = Field(default=None, max_length=255)
    start_date: date
    end_date: date


class EventUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    venue: str | None = Field(default=None, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    status: EventStatus | None = None


class EventClassRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    name: str
    level: str | None
    discipline: str | None
    scheduled_time: datetime | None
    ring: str | None


class EventClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    level: str | None = Field(default=None, max_length=100)
    discipline: str | None = Field(default=None, max_length=100)
    scheduled_time: datetime | None = None
    ring: str | None = Field(default=None, max_length=100)


class EventClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    level: str | None = Field(default=None, max_length=100)
    discipline: str | None = Field(default=None, max_length=100)
    scheduled_time: datetime | None = None
    ring: str | None = Field(default=None, max_length=100)


class RequirementFieldType(str, enum.Enum):
    text = "text"
    number = "number"
    select = "select"
    multiselect = "multiselect"


class RequirementField(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=64)
    label: str = Field(min_length=1, max_length=255)
    field_type: RequirementFieldType
    required: bool = False
    options: list[str] | None = None

    @model_validator(mode="after")
    def _check_options(self) -> "RequirementField":
        needs_options = self.field_type in (RequirementFieldType.select, RequirementFieldType.multiselect)
        if needs_options and not self.options:
            raise ValueError(f"field '{self.key}': {self.field_type.value} requires non-empty options")
        if not needs_options and self.options:
            raise ValueError(f"field '{self.key}': options only allowed for select/multiselect")
        return self


class EventContractRequirementsRead(BaseModel):
    fields: list[RequirementField]


class EventContractRequirementsUpdate(BaseModel):
    fields: list[RequirementField]

    @model_validator(mode="after")
    def _check_unique_keys(self) -> "EventContractRequirementsUpdate":
        keys = [f.key for f in self.fields]
        if len(keys) != len(set(keys)):
            raise ValueError("field keys must be unique")
        return self
