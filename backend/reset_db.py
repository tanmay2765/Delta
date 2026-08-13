"""Remove all data from the database."""

from app.database import SessionLocal, engine
from app.models import Meeting, Participant, User
from app.database import Base


def reset() -> None:
    db = SessionLocal()
    try:
        db.query(Participant).delete()
        db.query(Meeting).delete()
        db.query(User).delete()
        db.commit()
        print("All demo data removed.")
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    reset()
