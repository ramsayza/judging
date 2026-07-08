from sqlalchemy.orm import Session

from app.models.user import User

PROVIDER_SUB_FIELD = {
    "google": "google_sub",
    "facebook": "facebook_sub",
}


def upsert_oauth_user(
    db: Session, *, email: str, name: str, avatar_url: str | None, provider: str, provider_sub: str
) -> User:
    sub_field = PROVIDER_SUB_FIELD[provider]

    user = db.query(User).filter(getattr(User, sub_field) == provider_sub).one_or_none()
    if user is None:
        user = db.query(User).filter(User.email == email).one_or_none()

    if user is None:
        user = User(email=email, name=name, avatar_url=avatar_url)
        setattr(user, sub_field, provider_sub)
        db.add(user)
    else:
        user.name = name
        user.avatar_url = avatar_url
        setattr(user, sub_field, provider_sub)

    db.commit()
    db.refresh(user)
    return user


def get_or_create_dev_user(db: Session, *, email: str, name: str) -> User:
    user = db.query(User).filter(User.email == email).one_or_none()
    if user is None:
        user = User(email=email, name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_or_create_user_by_email(db: Session, *, email: str, name: str) -> tuple[User, bool]:
    """Look up a user globally by email (users aren't scoped to an org), creating
    one if this is the first time anyone's referenced them by email -- used both
    when inviting a judge and when a platform admin names an org's initial
    organizer."""
    user = db.query(User).filter(User.email == email).one_or_none()
    if user is not None:
        return user, False

    user = User(email=email, name=name)
    db.add(user)
    db.flush()
    return user, True
