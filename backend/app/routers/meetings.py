from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.realtime import broadcast_meeting_ended, broadcast_meeting_state
from app.schemas import (
    InstantMeetingCreate,
    JoinMeetingRequest,
    JoinMeetingResponse,
    JoinRequestActionResponse,
    JoinRequestResponse,
    LeaveMeetingRequest,
    MeetingInviteCreate,
    MeetingInviteResponse,
    MeetingResponse,
    ParticipantMediaUpdate,
    ParticipantPermissionsUpdate,
    ParticipantResponse,
    ResumeSessionRequest,
    ScheduledMeetingCreate,
    StartMeetingRequest,
)
from app.services import meeting_service

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def _frontend_origin(x_frontend_origin: str | None) -> str:
    return x_frontend_origin or "http://192.168.0.102:8081"


def _participant_response(participant, *, include_token: bool = False) -> ParticipantResponse:
    data = meeting_service.participant_to_dict(participant, include_session_token=include_token)
    return ParticipantResponse(**data)


def _meeting_response(meeting) -> MeetingResponse:
    return MeetingResponse(**meeting_service.meeting_to_response(meeting))


@router.post("/instant", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_instant_meeting(
    payload: InstantMeetingCreate,
    db: Session = Depends(get_db),
) -> MeetingResponse:
    meeting = meeting_service.create_instant_meeting(
        db,
        payload.host_name,
        title=payload.title,
        description=payload.description,
        join_policy=payload.join_policy,
        mic_on=payload.mic_on,
        camera_on=payload.camera_on,
    )
    return _meeting_response(meeting)


@router.post("/schedule", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def schedule_meeting(
    payload: ScheduledMeetingCreate,
    db: Session = Depends(get_db),
) -> MeetingResponse:
    meeting = meeting_service.create_scheduled_meeting(
        db,
        title=payload.title,
        description=payload.description,
        host_name=payload.host_name,
        scheduled_at=payload.scheduled_at,
        duration=payload.duration,
        join_policy=payload.join_policy,
    )
    return _meeting_response(meeting)


@router.get("/upcoming", response_model=list[MeetingResponse])
def list_upcoming_meetings(db: Session = Depends(get_db)) -> list[MeetingResponse]:
    meetings = meeting_service.get_upcoming_meetings(db)
    return [_meeting_response(meeting) for meeting in meetings]


@router.get("/recent", response_model=list[MeetingResponse])
def list_recent_meetings(db: Session = Depends(get_db)) -> list[MeetingResponse]:
    meetings = meeting_service.get_recent_meetings(db)
    return [_meeting_response(meeting) for meeting in meetings]


@router.get("/invite/{invite_code}", response_model=MeetingResponse)
def get_meeting_by_invite(invite_code: str, db: Session = Depends(get_db)) -> MeetingResponse:
    meeting = meeting_service.get_meeting_by_invite_code(db, invite_code)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return _meeting_response(meeting)


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)) -> MeetingResponse:
    meeting = meeting_service.get_meeting_details(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return _meeting_response(meeting)


@router.post("/{meeting_id}/join", response_model=JoinMeetingResponse)
async def join_meeting(
    meeting_id: str,
    payload: JoinMeetingRequest,
    db: Session = Depends(get_db),
) -> JoinMeetingResponse:
    try:
        meeting, participant, join_status, join_request = meeting_service.join_meeting(
            db,
            meeting_id,
            payload.display_name,
            mic_on=payload.mic_on,
            camera_on=payload.camera_on,
            participant_id=payload.participant_id,
            session_token=payload.session_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if join_status == "awaiting_approval":
        return JoinMeetingResponse(
            meeting=_meeting_response(meeting),
            participant=None,
            status="awaiting_approval",
            join_request_id=join_request.id if join_request else None,
        )

    await broadcast_meeting_state(meeting_id)
    return JoinMeetingResponse(
        meeting=_meeting_response(meeting),
        participant=_participant_response(participant, include_token=True),
        status="joined",
    )


@router.post("/{meeting_id}/participants/{participant_id}/resume", response_model=JoinMeetingResponse)
async def resume_meeting_session(
    meeting_id: str,
    participant_id: int,
    payload: ResumeSessionRequest,
    db: Session = Depends(get_db),
) -> JoinMeetingResponse:
    try:
        meeting, participant = meeting_service.resume_participant(
            db,
            meeting_id,
            participant_id,
            payload.session_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return JoinMeetingResponse(
        meeting=_meeting_response(meeting),
        participant=_participant_response(participant, include_token=True),
        status="joined",
    )


@router.post("/{meeting_id}/start", response_model=MeetingResponse)
async def start_meeting(
    meeting_id: str,
    payload: StartMeetingRequest,
    participant_id: int,
    db: Session = Depends(get_db),
) -> MeetingResponse:
    try:
        meeting, started_now = meeting_service.start_meeting_session(
            db,
            meeting_id,
            participant_id,
            payload.session_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if started_now:
        await broadcast_meeting_state(meeting_id)

    return _meeting_response(meeting)


@router.patch("/{meeting_id}/participants/{participant_id}/media", response_model=ParticipantResponse)
async def update_participant_media(
    meeting_id: str,
    participant_id: int,
    payload: ParticipantMediaUpdate,
    db: Session = Depends(get_db),
) -> ParticipantResponse:
    try:
        participant = meeting_service.update_participant_media(
            db,
            meeting_id,
            participant_id,
            payload.session_token,
            mic_on=payload.mic_on,
            camera_on=payload.camera_on,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await broadcast_meeting_state(meeting_id)
    return _participant_response(participant)


@router.patch(
    "/{meeting_id}/participants/{participant_id}/permissions",
    response_model=ParticipantResponse,
)
async def update_participant_permissions(
    meeting_id: str,
    participant_id: int,
    payload: ParticipantPermissionsUpdate,
    host_participant_id: int,
    db: Session = Depends(get_db),
) -> ParticipantResponse:
    try:
        participant = meeting_service.update_participant_permissions(
            db,
            meeting_id,
            host_participant_id,
            payload.host_session_token,
            participant_id,
            mic_allowed=payload.mic_allowed,
            camera_allowed=payload.camera_allowed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await broadcast_meeting_state(meeting_id)
    return _participant_response(participant)


@router.post("/{meeting_id}/participants/{participant_id}/leave", response_model=MeetingResponse)
async def leave_meeting(
    meeting_id: str,
    participant_id: int,
    payload: LeaveMeetingRequest,
    db: Session = Depends(get_db),
) -> MeetingResponse:
    try:
        meeting = meeting_service.leave_meeting(db, meeting_id, participant_id, payload.session_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if meeting.status == "ended":
        await broadcast_meeting_ended(meeting_id)
    else:
        await broadcast_meeting_state(meeting_id)
    return _meeting_response(meeting)


@router.get("/{meeting_id}/join-requests", response_model=list[JoinRequestResponse])
def list_join_requests(meeting_id: str, db: Session = Depends(get_db)) -> list[JoinRequestResponse]:
    try:
        requests = meeting_service.list_join_requests(db, meeting_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [JoinRequestResponse.model_validate(item) for item in requests]


@router.post(
    "/{meeting_id}/join-requests/{request_id}/approve",
    response_model=JoinRequestActionResponse,
)
async def approve_join_request(
    meeting_id: str,
    request_id: int,
    db: Session = Depends(get_db),
) -> JoinRequestActionResponse:
    try:
        join_request, participant = meeting_service.approve_join_request(db, meeting_id, request_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    await broadcast_meeting_state(meeting_id)
    return JoinRequestActionResponse(
        join_request=JoinRequestResponse.model_validate(join_request),
        participant=_participant_response(participant, include_token=True),
    )


@router.post(
    "/{meeting_id}/join-requests/{request_id}/deny",
    response_model=JoinRequestResponse,
)
async def deny_join_request(
    meeting_id: str,
    request_id: int,
    db: Session = Depends(get_db),
) -> JoinRequestResponse:
    try:
        join_request = meeting_service.deny_join_request(db, meeting_id, request_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return JoinRequestResponse.model_validate(join_request)


@router.post("/{meeting_id}/invites", response_model=MeetingInviteResponse, status_code=status.HTTP_201_CREATED)
def invite_to_meeting(
    meeting_id: str,
    payload: MeetingInviteCreate,
    db: Session = Depends(get_db),
    x_frontend_origin: str | None = Header(default=None),
) -> MeetingInviteResponse:
    try:
        invite, invite_link = meeting_service.create_meeting_invite(
            db,
            meeting_id,
            payload.email,
            frontend_origin=_frontend_origin(x_frontend_origin),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return MeetingInviteResponse(
        id=invite.id,
        email=invite.email,
        invite_link=invite_link,
        created_at=invite.created_at,
    )


@router.post("/{meeting_id}/end", response_model=MeetingResponse)
async def end_meeting(meeting_id: str, db: Session = Depends(get_db)) -> MeetingResponse:
    try:
        meeting = meeting_service.end_meeting(db, meeting_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await broadcast_meeting_ended(meeting_id)
    return _meeting_response(meeting)
