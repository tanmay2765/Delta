from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


JoinPolicy = Literal["open", "approval_required"]


class InstantMeetingCreate(BaseModel):
    host_name: str = Field(..., min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    join_policy: JoinPolicy = "open"
    mic_on: bool = True
    camera_on: bool = True


class ScheduledMeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    host_name: str = Field(..., min_length=1, max_length=100)
    scheduled_at: datetime
    duration: int = Field(..., gt=0, le=480)
    join_policy: JoinPolicy = "open"

    @field_validator("scheduled_at")
    @classmethod
    def scheduled_at_must_be_future(cls, value: datetime) -> datetime:
        scheduled = to_naive_utc(value)
        if scheduled <= datetime.utcnow():
            raise ValueError("scheduled_at must be in the future")
        return scheduled


class JoinMeetingRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    mic_on: bool = True
    camera_on: bool = True
    participant_id: int | None = None
    session_token: str | None = None


class ParticipantMediaUpdate(BaseModel):
    session_token: str
    mic_on: bool | None = None
    camera_on: bool | None = None


class ParticipantPermissionsUpdate(BaseModel):
    host_session_token: str
    mic_allowed: bool | None = None
    camera_allowed: bool | None = None


class LeaveMeetingRequest(BaseModel):
    session_token: str


class ResumeSessionRequest(BaseModel):
    session_token: str


class StartMeetingRequest(BaseModel):
    session_token: str


class HostSessionRequest(BaseModel):
    session_token: str


class MeetingInviteCreate(BaseModel):
    email: EmailStr


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    is_host: bool
    is_active: bool
    mic_allowed: bool
    camera_allowed: bool
    mic_on: bool
    camera_on: bool
    joined_at: datetime
    session_token: str | None = None


class JoinRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    status: str
    created_at: datetime


class MeetingInviteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    invite_link: str
    created_at: datetime


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: str
    title: str | None
    description: str | None
    host_name: str
    scheduled_at: datetime | None
    duration: int | None
    invite_code: str
    join_policy: JoinPolicy
    status: str
    created_at: datetime
    started_at: datetime | None = None
    participants: list[ParticipantResponse] = []


class JoinMeetingResponse(BaseModel):
    meeting: MeetingResponse
    participant: ParticipantResponse | None = None
    status: Literal["joined", "awaiting_approval"] = "joined"
    join_request_id: int | None = None


class JoinRequestActionResponse(BaseModel):
    join_request: JoinRequestResponse
    participant: ParticipantResponse | None = None
