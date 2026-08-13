import secrets
import string
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import JoinRequest, Meeting, MeetingInvite, Participant


def normalize_meeting_id(meeting_id: str) -> str:
    """Strip spaces and non-digit characters for consistent lookup."""
    return "".join(char for char in meeting_id if char.isdigit())


def format_meeting_id(meeting_id: str) -> str:
    """Return meeting ID in human-readable form: 123 456 789."""
    digits = normalize_meeting_id(meeting_id)
    if len(digits) != 9:
        return digits
    return f"{digits[:3]} {digits[3:6]} {digits[6:]}"


def generate_meeting_id(db: Session) -> str:
    while True:
        digits = "".join(str(secrets.randbelow(10)) for _ in range(9))
        if digits[0] == "0":
            continue
        if not db.query(Meeting).filter(Meeting.meeting_id == digits).first():
            return digits


def generate_invite_code(db: Session) -> str:
    alphabet = string.ascii_lowercase + string.digits
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(10))
        if not db.query(Meeting).filter(Meeting.invite_code == code).first():
            return code


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def get_meeting_by_identifier(db: Session, identifier: str) -> Meeting | None:
    normalized = normalize_meeting_id(identifier)
    if normalized:
        meeting = db.query(Meeting).filter(Meeting.meeting_id == normalized).first()
        if meeting:
            return meeting

    return db.query(Meeting).filter(Meeting.invite_code == identifier).first()


def active_participants(meeting: Meeting) -> list[Participant]:
    return [participant for participant in meeting.participants if participant.is_active]


def find_active_participant_by_name(
    db: Session,
    meeting: Meeting,
    display_name: str,
    *,
    exclude_host: bool = True,
) -> Participant | None:
    query = db.query(Participant).filter(
        Participant.meeting_id == meeting.id,
        Participant.display_name == display_name,
        Participant.is_active.is_(True),
    )
    if exclude_host:
        query = query.filter(Participant.is_host.is_(False))
    return query.first()


def has_approved_join_request(db: Session, meeting: Meeting, display_name: str) -> bool:
    return (
        db.query(JoinRequest)
        .filter(
            JoinRequest.meeting_id == meeting.id,
            JoinRequest.display_name == display_name,
            JoinRequest.status == "approved",
        )
        .first()
        is not None
    )


def close_pending_join_requests(
    db: Session,
    meeting: Meeting,
    display_name: str,
    *,
    except_request_id: int | None = None,
) -> None:
    query = db.query(JoinRequest).filter(
        JoinRequest.meeting_id == meeting.id,
        JoinRequest.display_name == display_name,
        JoinRequest.status == "pending",
    )
    if except_request_id is not None:
        query = query.filter(JoinRequest.id != except_request_id)
    for pending in query.all():
        pending.status = "denied"


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    # Naive datetimes are stored as UTC — suffix Z so browsers parse correctly.
    return value.isoformat() + "Z"


def participant_to_dict(participant: Participant, *, include_session_token: bool = False) -> dict:
    payload = {
        "id": participant.id,
        "display_name": participant.display_name,
        "is_host": participant.is_host,
        "is_active": participant.is_active,
        "mic_allowed": participant.mic_allowed,
        "camera_allowed": participant.camera_allowed,
        "mic_on": participant.mic_on,
        "camera_on": participant.camera_on,
        "joined_at": _serialize_datetime(participant.joined_at),
    }
    if include_session_token:
        payload["session_token"] = participant.session_token
    return payload


def add_host_participant(
    db: Session,
    meeting: Meeting,
    *,
    mic_on: bool = True,
    camera_on: bool = True,
) -> Participant:
    participant = Participant(
        meeting_id=meeting.id,
        display_name=meeting.host_name,
        session_token=generate_session_token(),
        is_host=True,
        is_active=True,
        mic_allowed=True,
        camera_allowed=True,
        mic_on=mic_on,
        camera_on=camera_on,
        joined_at=datetime.utcnow(),
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


def create_instant_meeting(
    db: Session,
    host_name: str,
    *,
    title: str | None = None,
    description: str | None = None,
    join_policy: str = "open",
    mic_on: bool = True,
    camera_on: bool = True,
) -> Meeting:
    meeting = Meeting(
        meeting_id=generate_meeting_id(db),
        title=title.strip() if title else None,
        description=description.strip() if description else None,
        host_name=host_name.strip(),
        scheduled_at=None,
        duration=None,
        invite_code=generate_invite_code(db),
        join_policy=join_policy,
        status="active",
        created_at=datetime.utcnow(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    add_host_participant(db, meeting, mic_on=mic_on, camera_on=camera_on)
    db.refresh(meeting)
    return meeting


def create_scheduled_meeting(
    db: Session,
    *,
    title: str,
    description: str | None,
    host_name: str,
    scheduled_at: datetime,
    duration: int,
    join_policy: str = "open",
) -> Meeting:
    meeting = Meeting(
        meeting_id=generate_meeting_id(db),
        title=title.strip(),
        description=description.strip() if description else None,
        host_name=host_name.strip(),
        scheduled_at=scheduled_at,
        duration=duration,
        invite_code=generate_invite_code(db),
        join_policy=join_policy,
        status="scheduled",
        created_at=datetime.utcnow(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    add_host_participant(db, meeting)
    db.refresh(meeting)
    return meeting


def get_upcoming_meetings(db: Session) -> list[Meeting]:
    now = datetime.utcnow()
    return (
        db.query(Meeting)
        .filter(
            Meeting.status == "scheduled",
            Meeting.scheduled_at.isnot(None),
            Meeting.scheduled_at >= now,
        )
        .order_by(Meeting.scheduled_at.asc())
        .all()
    )


def get_recent_meetings(db: Session, limit: int = 10) -> list[Meeting]:
    return (
        db.query(Meeting)
        .filter(Meeting.status.in_(["active", "ended"]))
        .order_by(Meeting.created_at.desc())
        .limit(limit)
        .all()
    )


def get_meeting_activity(db: Session, days: int = 7) -> list[dict]:
    """Return meeting counts grouped by day for the activity chart."""
    now = datetime.utcnow()
    start = now - timedelta(days=days - 1)
    meetings = (
        db.query(Meeting)
        .filter(Meeting.created_at >= start.replace(hour=0, minute=0, second=0, microsecond=0))
        .all()
    )

    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    buckets: dict[str, int] = {label: 0 for label in labels}

    for meeting in meetings:
        label = labels[meeting.created_at.weekday()]
        buckets[label] += 1

    return [{"date": label, "count": buckets[label]} for label in labels]


def get_meeting_details(db: Session, identifier: str) -> Meeting | None:
    return get_meeting_by_identifier(db, identifier)


def get_meeting_by_invite_code(db: Session, invite_code: str) -> Meeting | None:
    return db.query(Meeting).filter(Meeting.invite_code == invite_code).first()


def verify_participant_session(
    db: Session,
    meeting_identifier: str,
    participant_id: int,
    session_token: str,
) -> tuple[Meeting | None, Participant | None]:
    meeting = get_meeting_by_identifier(db, meeting_identifier)
    if not meeting:
        return None, None

    participant = (
        db.query(Participant)
        .filter(
            Participant.id == participant_id,
            Participant.meeting_id == meeting.id,
            Participant.session_token == session_token,
            Participant.is_active.is_(True),
        )
        .first()
    )
    if not participant:
        return meeting, None
    return meeting, participant


def mark_meeting_started(db: Session, meeting: Meeting, participant: Participant) -> bool:
    """Record the moment the host enters the room. Returns True if just started."""
    if not participant.is_host or meeting.started_at is not None:
        return False
    meeting.started_at = datetime.utcnow()
    db.commit()
    db.refresh(meeting)
    return True


def resume_participant(
    db: Session,
    meeting_identifier: str,
    participant_id: int,
    session_token: str,
) -> tuple[Meeting, Participant]:
    meeting, participant = verify_participant_session(db, meeting_identifier, participant_id, session_token)
    if not meeting:
        raise ValueError("Meeting not found")
    if not participant:
        raise ValueError("Invalid or expired session")
    if meeting.status == "ended":
        raise ValueError("Meeting has ended")
    return meeting, participant


def start_meeting_session(
    db: Session,
    meeting_identifier: str,
    participant_id: int,
    session_token: str,
) -> tuple[Meeting, bool]:
    meeting, participant = verify_participant_session(db, meeting_identifier, participant_id, session_token)
    if not meeting:
        raise ValueError("Meeting not found")
    if not participant:
        raise ValueError("Invalid session")
    if not participant.is_host:
        raise ValueError("Only the host can start the meeting")
    if meeting.status == "ended":
        raise ValueError("Meeting has ended")

    started_now = False
    if meeting.started_at is None:
        meeting.started_at = datetime.utcnow()
        db.commit()
        db.refresh(meeting)
        started_now = True

    return meeting, started_now


def join_meeting(
    db: Session,
    identifier: str,
    display_name: str,
    *,
    mic_on: bool = True,
    camera_on: bool = True,
    participant_id: int | None = None,
    session_token: str | None = None,
) -> tuple[Meeting, Participant | None, str, JoinRequest | None]:
    meeting = get_meeting_by_identifier(db, identifier)
    if not meeting:
        raise ValueError("Meeting not found")

    if meeting.status == "ended":
        raise ValueError("Meeting has ended")

    if participant_id and session_token:
        resumed_meeting, participant = verify_participant_session(db, identifier, participant_id, session_token)
        if participant:
            participant.mic_on = mic_on if participant.mic_allowed else False
            participant.camera_on = camera_on if participant.camera_allowed else False
            db.commit()
            db.refresh(participant)
            db.refresh(resumed_meeting)
            return resumed_meeting, participant, "joined", None

    cleaned_name = display_name.strip()

    if meeting.join_policy == "approval_required":
        existing = find_active_participant_by_name(db, meeting, cleaned_name)
        if existing and has_approved_join_request(db, meeting, cleaned_name):
            existing.mic_on = mic_on if existing.mic_allowed else False
            existing.camera_on = camera_on if existing.camera_allowed else False
            close_pending_join_requests(db, meeting, cleaned_name)
            db.commit()
            db.refresh(existing)
            db.refresh(meeting)
            return meeting, existing, "joined", None

        pending = (
            db.query(JoinRequest)
            .filter(
                JoinRequest.meeting_id == meeting.id,
                JoinRequest.display_name == cleaned_name,
                JoinRequest.status == "pending",
            )
            .first()
        )
        if pending:
            return meeting, None, "awaiting_approval", pending

        join_request = JoinRequest(
            meeting_id=meeting.id,
            display_name=cleaned_name,
            status="pending",
            created_at=datetime.utcnow(),
        )
        db.add(join_request)
        db.commit()
        db.refresh(join_request)
        db.refresh(meeting)
        return meeting, None, "awaiting_approval", join_request

    participant = Participant(
        meeting_id=meeting.id,
        display_name=cleaned_name,
        session_token=generate_session_token(),
        is_host=False,
        is_active=True,
        mic_allowed=True,
        camera_allowed=True,
        mic_on=mic_on,
        camera_on=camera_on,
        joined_at=datetime.utcnow(),
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    db.refresh(meeting)
    return meeting, participant, "joined", None


def update_participant_media(
    db: Session,
    meeting_identifier: str,
    participant_id: int,
    session_token: str,
    *,
    mic_on: bool | None = None,
    camera_on: bool | None = None,
) -> Participant:
    meeting, participant = verify_participant_session(db, meeting_identifier, participant_id, session_token)
    if not meeting:
        raise ValueError("Meeting not found")
    if not participant:
        raise ValueError("Invalid session")

    if mic_on is not None:
        if mic_on and not participant.mic_allowed and not participant.is_host:
            raise ValueError("Microphone permission not granted by host")
        participant.mic_on = mic_on if participant.mic_allowed or participant.is_host else False

    if camera_on is not None:
        if camera_on and not participant.camera_allowed and not participant.is_host:
            raise ValueError("Camera permission not granted by host")
        participant.camera_on = camera_on if participant.camera_allowed or participant.is_host else False

    db.commit()
    db.refresh(participant)
    return participant


def update_participant_permissions(
    db: Session,
    meeting_identifier: str,
    host_participant_id: int,
    host_session_token: str,
    target_participant_id: int,
    *,
    mic_allowed: bool | None = None,
    camera_allowed: bool | None = None,
) -> Participant:
    meeting, host = verify_participant_session(db, meeting_identifier, host_participant_id, host_session_token)
    if not meeting or not host or not host.is_host:
        raise ValueError("Only the host can change permissions")

    target = (
        db.query(Participant)
        .filter(Participant.id == target_participant_id, Participant.meeting_id == meeting.id)
        .first()
    )
    if not target:
        raise ValueError("Participant not found")
    if target.is_host:
        raise ValueError("Cannot change host permissions")

    if mic_allowed is not None:
        target.mic_allowed = mic_allowed
        if not mic_allowed:
            target.mic_on = False

    if camera_allowed is not None:
        target.camera_allowed = camera_allowed
        if not camera_allowed:
            target.camera_on = False

    db.commit()
    db.refresh(target)
    return target


def leave_meeting(
    db: Session,
    meeting_identifier: str,
    participant_id: int,
    session_token: str,
) -> Meeting:
    meeting, participant = verify_participant_session(db, meeting_identifier, participant_id, session_token)
    if not meeting or not participant:
        raise ValueError("Invalid session")

    if participant.is_host:
        meeting.status = "ended"
        for member in meeting.participants:
            member.is_active = False
            member.mic_on = False
            member.camera_on = False
    else:
        participant.is_active = False
        participant.mic_on = False
        participant.camera_on = False

    db.commit()
    db.refresh(meeting)
    return meeting


def verify_host_session(
    db: Session,
    meeting_identifier: str,
    host_participant_id: int,
    host_session_token: str,
) -> tuple[Meeting, Participant]:
    meeting, host = verify_participant_session(db, meeting_identifier, host_participant_id, host_session_token)
    if not meeting or not host or not host.is_host:
        raise ValueError("Only the host can perform this action")
    return meeting, host


def list_join_requests(
    db: Session,
    meeting_identifier: str,
    host_participant_id: int,
    host_session_token: str,
) -> list[JoinRequest]:
    meeting, _ = verify_host_session(db, meeting_identifier, host_participant_id, host_session_token)
    active_names = {
        participant.display_name
        for participant in active_participants(meeting)
        if not participant.is_host
    }
    requests = (
        db.query(JoinRequest)
        .filter(JoinRequest.meeting_id == meeting.id, JoinRequest.status == "pending")
        .order_by(JoinRequest.created_at.asc())
        .all()
    )
    return [request for request in requests if request.display_name not in active_names]


def approve_join_request(
    db: Session,
    meeting_identifier: str,
    request_id: int,
    host_participant_id: int,
    host_session_token: str,
) -> tuple[JoinRequest, Participant]:
    meeting, _ = verify_host_session(db, meeting_identifier, host_participant_id, host_session_token)

    join_request = (
        db.query(JoinRequest)
        .filter(JoinRequest.id == request_id, JoinRequest.meeting_id == meeting.id)
        .first()
    )
    if not join_request:
        raise ValueError("Join request not found")
    if join_request.status != "pending":
        raise ValueError("Join request is not pending")

    existing = find_active_participant_by_name(db, meeting, join_request.display_name)
    if existing:
        join_request.status = "approved"
        close_pending_join_requests(db, meeting, join_request.display_name, except_request_id=request_id)
        db.commit()
        db.refresh(join_request)
        return join_request, existing

    participant = Participant(
        meeting_id=meeting.id,
        display_name=join_request.display_name,
        session_token=generate_session_token(),
        is_host=False,
        is_active=True,
        mic_allowed=True,
        camera_allowed=True,
        mic_on=True,
        camera_on=True,
        joined_at=datetime.utcnow(),
    )
    join_request.status = "approved"
    db.add(participant)
    close_pending_join_requests(db, meeting, join_request.display_name, except_request_id=request_id)
    db.commit()
    db.refresh(join_request)
    db.refresh(participant)
    return join_request, participant


def deny_join_request(
    db: Session,
    meeting_identifier: str,
    request_id: int,
    host_participant_id: int,
    host_session_token: str,
) -> JoinRequest:
    meeting, _ = verify_host_session(db, meeting_identifier, host_participant_id, host_session_token)

    join_request = (
        db.query(JoinRequest)
        .filter(JoinRequest.id == request_id, JoinRequest.meeting_id == meeting.id)
        .first()
    )
    if not join_request:
        raise ValueError("Join request not found")
    if join_request.status != "pending":
        raise ValueError("Join request is not pending")

    join_request.status = "denied"
    db.commit()
    db.refresh(join_request)
    return join_request


def create_meeting_invite(
    db: Session,
    meeting_identifier: str,
    email: str,
    *,
    frontend_origin: str = "http://192.168.0.102:8081",
) -> tuple[MeetingInvite, str]:
    meeting = get_meeting_by_identifier(db, meeting_identifier)
    if not meeting:
        raise ValueError("Meeting not found")

    invite = MeetingInvite(
        meeting_id=meeting.id,
        email=email.strip().lower(),
        created_at=datetime.utcnow(),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    invite_link = f"{frontend_origin.rstrip('/')}/join?code={meeting.invite_code}"
    return invite, invite_link


def end_meeting(
    db: Session,
    identifier: str,
    host_participant_id: int,
    host_session_token: str,
) -> Meeting:
    meeting, host = verify_participant_session(db, identifier, host_participant_id, host_session_token)
    if not meeting or not host or not host.is_host:
        raise ValueError("Only the host can end the meeting")
    meeting.status = "ended"
    for participant in meeting.participants:
        participant.is_active = False
        participant.mic_on = False
        participant.camera_on = False
    db.commit()
    db.refresh(meeting)
    return meeting


def mute_all_participants(
    db: Session,
    meeting_identifier: str,
    host_participant_id: int,
    host_session_token: str,
) -> Meeting:
    meeting, host = verify_participant_session(db, meeting_identifier, host_participant_id, host_session_token)
    if not meeting or not host or not host.is_host:
        raise ValueError("Only the host can mute all participants")

    for participant in meeting.participants:
        if participant.is_active and not participant.is_host:
            participant.mic_allowed = False
            participant.mic_on = False

    db.commit()
    db.refresh(meeting)
    return meeting


def remove_participant(
    db: Session,
    meeting_identifier: str,
    host_participant_id: int,
    host_session_token: str,
    target_participant_id: int,
) -> Participant:
    meeting, host = verify_participant_session(db, meeting_identifier, host_participant_id, host_session_token)
    if not meeting or not host or not host.is_host:
        raise ValueError("Only the host can remove participants")

    target = (
        db.query(Participant)
        .filter(Participant.id == target_participant_id, Participant.meeting_id == meeting.id)
        .first()
    )
    if not target:
        raise ValueError("Participant not found")
    if target.is_host:
        raise ValueError("Cannot remove the host")

    target.is_active = False
    target.mic_on = False
    target.camera_on = False
    db.commit()
    db.refresh(target)
    return target


def meeting_to_response(meeting: Meeting) -> dict:
    return {
        "id": meeting.id,
        "meeting_id": format_meeting_id(meeting.meeting_id),
        "title": meeting.title,
        "description": meeting.description,
        "host_name": meeting.host_name,
        "scheduled_at": _serialize_datetime(meeting.scheduled_at),
        "duration": meeting.duration,
        "invite_code": meeting.invite_code,
        "join_policy": meeting.join_policy,
        "status": meeting.status,
        "created_at": _serialize_datetime(meeting.created_at),
        "started_at": _serialize_datetime(meeting.started_at),
        "participants": [
            participant_to_dict(participant)
            for participant in active_participants(meeting)
        ],
    }
