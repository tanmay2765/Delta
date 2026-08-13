"""Seed the database with a default user and sample meetings for evaluation."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import Base, SessionLocal, engine, run_migrations
from app.models import JoinRequest, Meeting, MeetingInvite, Participant, User
from app.services import meeting_service

DEFAULT_EMAIL = "demo@delta.com"
DEFAULT_PASSWORD = "demo123456"
DEFAULT_NAME = "Demo User"


def clear_all(db: Session) -> None:
    db.query(JoinRequest).delete()
    db.query(MeetingInvite).delete()
    db.query(Participant).delete()
    db.query(Meeting).delete()
    db.query(User).delete()
    db.commit()


def seed(db: Session, *, reset: bool = False) -> None:
    if reset:
        clear_all(db)

    if db.query(User).filter(User.email == DEFAULT_EMAIL).first():
        print("Seed skipped — demo user already exists.")
        return

    user = User(
        email=DEFAULT_EMAIL,
        full_name=DEFAULT_NAME,
        password_hash=hash_password(DEFAULT_PASSWORD),
        phone="+91 98765 43210",
        timezone="Asia/Kolkata",
        language="English",
        date_format="mm/dd/yyyy",
        time_format="12h",
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    now = datetime.utcnow()

    # Upcoming scheduled meetings
    standup = meeting_service.create_scheduled_meeting(
        db,
        title="Daily Standup",
        description="Team sync for Delta evaluation demo.",
        host_name=DEFAULT_NAME,
        scheduled_at=now + timedelta(hours=2),
        duration=30,
        join_policy="open",
    )
    standup.participants[0].is_active = False
    db.commit()

    planning = meeting_service.create_scheduled_meeting(
        db,
        title="Sprint Planning",
        description="Plan next sprint backlog items.",
        host_name=DEFAULT_NAME,
        scheduled_at=now + timedelta(days=1, hours=3),
        duration=60,
        join_policy="approval_required",
    )
    planning.participants[0].is_active = False
    db.commit()

    # Active instant meeting (can rejoin)
    live = meeting_service.create_instant_meeting(
        db,
        host_name=DEFAULT_NAME,
        title="Instant Meeting",
        description="Open demo meeting for evaluators.",
        join_policy="open",
        mic_on=True,
        camera_on=True,
    )
    live.started_at = now - timedelta(minutes=12)
    live.participants[0].is_active = False
    db.commit()

    # Past ended meetings
    for index, title in enumerate(["Product Review", "Design Critique", "Client Demo"], start=1):
        ended = meeting_service.create_instant_meeting(
            db,
            host_name=DEFAULT_NAME,
            title=title,
            description=f"Completed meeting #{index} for dashboard history.",
            join_policy="open",
        )
        ended.status = "ended"
        ended.started_at = now - timedelta(days=index, hours=2)
        ended.created_at = now - timedelta(days=index, hours=3)
        for participant in ended.participants:
            participant.is_active = False
            participant.mic_on = False
            participant.camera_on = False
        db.commit()

        guest = Participant(
            meeting_id=ended.id,
            display_name=f"Guest {index}",
            session_token=meeting_service.generate_session_token(),
            is_host=False,
            is_active=False,
            mic_allowed=True,
            camera_allowed=True,
            mic_on=False,
            camera_on=False,
            joined_at=ended.started_at or ended.created_at,
        )
        db.add(guest)
        db.commit()

    print("Seed complete.")
    print(f"  Default user: {DEFAULT_EMAIL} / {DEFAULT_PASSWORD}")
    print(f"  Upcoming meetings: 2")
    print(f"  Recent meetings: 4")
    print(f"  Live demo meeting ID: {live.meeting_id}")


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    run_migrations()
    db = SessionLocal()
    try:
        seed(db, reset=True)
    finally:
        db.close()
