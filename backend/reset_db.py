"""Remove all data from the database."""

from app.database import Base, SessionLocal, engine, run_migrations
from app.models import JoinRequest, Meeting, MeetingInvite, Participant, User


def reset() -> None:
    db = SessionLocal()
    try:
        db.query(JoinRequest).delete()
        db.query(MeetingInvite).delete()
        db.query(Participant).delete()
        db.query(Meeting).delete()
        db.query(User).delete()
        db.commit()
        print("All data removed.")
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    run_migrations()
    reset()
