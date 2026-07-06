from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_TTL = timedelta(minutes=15)


def create_api_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + ACCESS_TOKEN_TTL,
    }
    return jwt.encode(payload, settings.backend_jwt_secret, algorithm=ALGORITHM)


def decode_api_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.backend_jwt_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("invalid or expired token") from exc
