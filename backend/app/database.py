import os
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./delta.db")

_connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


def run_migrations() -> None:
    with engine.begin() as conn:
        if not _column_exists(conn, "meetings", "join_policy"):
            conn.execute(
                text("ALTER TABLE meetings ADD COLUMN join_policy VARCHAR(30) NOT NULL DEFAULT 'open'")
            )
        if not _column_exists(conn, "meetings", "started_at"):
            conn.execute(text("ALTER TABLE meetings ADD COLUMN started_at DATETIME"))

        participant_columns = {
            "is_host": "BOOLEAN NOT NULL DEFAULT 0",
            "mic_on": "BOOLEAN NOT NULL DEFAULT 0",
            "camera_on": "BOOLEAN NOT NULL DEFAULT 0",
            "session_token": "VARCHAR(64) NOT NULL DEFAULT ''",
            "is_active": "BOOLEAN NOT NULL DEFAULT 1",
            "mic_allowed": "BOOLEAN NOT NULL DEFAULT 0",
            "camera_allowed": "BOOLEAN NOT NULL DEFAULT 0",
        }
        for column, definition in participant_columns.items():
            if not _column_exists(conn, "participants", column):
                conn.execute(text(f"ALTER TABLE participants ADD COLUMN {column} {definition}"))

        conn.execute(
            text(
                "UPDATE participants SET session_token = lower(hex(randomblob(16))) "
                "WHERE session_token IS NULL OR session_token = ''"
            )
        )
        conn.execute(text("UPDATE participants SET mic_allowed = 1, camera_allowed = 1 WHERE is_host = 1"))
        conn.execute(text("UPDATE participants SET mic_allowed = 1, camera_allowed = 1 WHERE is_host = 0 AND mic_allowed = 0 AND camera_allowed = 0"))

        user_columns = {
            "phone": "VARCHAR(30)",
            "timezone": "VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata'",
            "language": "VARCHAR(32) NOT NULL DEFAULT 'English'",
            "date_format": "VARCHAR(20) NOT NULL DEFAULT 'mm/dd/yyyy'",
            "time_format": "VARCHAR(20) NOT NULL DEFAULT '12h'",
        }
        for column, definition in user_columns.items():
            if not _column_exists(conn, "users", column):
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column} {definition}"))
