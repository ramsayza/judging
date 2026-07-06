from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

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
