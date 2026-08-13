from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.models import User


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, *, full_name: str, email: str, password: str) -> User:
    user = User(
        full_name=full_name.strip(),
        email=email.lower().strip(),
        password_hash=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def update_user(db: Session, user: User, **fields) -> User:
    for key, value in fields.items():
        if value is None:
            continue
        if key == "phone":
            cleaned = value.strip()
            setattr(user, key, cleaned or None)
        elif key == "full_name":
            setattr(user, key, value.strip())
        else:
            setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user
