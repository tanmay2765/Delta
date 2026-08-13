from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import create_access_token, decode_access_token
from app.database import get_db
from app.schemas_auth import AuthResponse, UserCreate, UserLogin, UserResponse, UserUpdate
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Session = Depends(get_db),
):
    if credentials is None:
        return None
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        return None
    try:
        return auth_service.get_user_by_id(db, int(user_id))
    except ValueError:
        return None


def require_user(
    user=Depends(get_current_user),
):
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    if auth_service.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = auth_service.create_user(
        db,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
    )
    token = create_access_token(str(user.id))
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> AuthResponse:
    user = auth_service.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(str(user.id))
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(user=Depends(require_user)) -> UserResponse:
    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    user=Depends(require_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    updated = auth_service.update_user(
        db,
        user,
        full_name=payload.full_name,
        phone=payload.phone,
        timezone=payload.timezone,
        language=payload.language,
        date_format=payload.date_format,
        time_format=payload.time_format,
    )
    return UserResponse.model_validate(updated)
