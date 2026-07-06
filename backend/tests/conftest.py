from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.security import create_api_token
from app.db import get_db
from app.main import app
from app.models import (
    Event,
    EventClass,
    Membership,
    MembershipRole,
    MembershipStatus,
    Organization,
    User,
)

engine = create_engine(settings.database_url)
TestingSessionLocal = sessionmaker(bind=engine)


@pytest.fixture()
def db_session():
    """Wrap each test in an outer transaction + SAVEPOINT so that application code
    calling session.commit() doesn't leak data between tests (standard SQLAlchemy
    'join a session into an external transaction' recipe)."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(sess, trans):
        if trans.nested and not trans._parent.nested:
            sess.begin_nested()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    yield session
    app.dependency_overrides.pop(get_db, None)
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    return TestClient(app)


def make_user(db, email: str, name: str = "Test User") -> User:
    user = User(email=email, name=name)
    db.add(user)
    db.flush()
    return user


def make_org(db, slug: str = "test-org", name: str = "Test Org") -> Organization:
    org = Organization(name=name, slug=slug)
    db.add(org)
    db.flush()
    return org


def make_membership(
    db, user: User, org: Organization, role: MembershipRole, status: MembershipStatus = MembershipStatus.active
) -> Membership:
    membership = Membership(user_id=user.id, organization_id=org.id, role=role, status=status)
    db.add(membership)
    db.flush()
    return membership


def make_event(db, org: Organization, creator: User, name: str = "Test Event") -> Event:
    ev = Event(
        organization_id=org.id,
        name=name,
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 2),
        created_by_user_id=creator.id,
    )
    db.add(ev)
    db.flush()
    return ev


def make_class(db, ev: Event, name: str = "Novice Jumping") -> EventClass:
    cls = EventClass(event_id=ev.id, name=name)
    db.add(cls)
    db.flush()
    return cls


def auth_header(user: User) -> dict:
    token = create_api_token(user_id=user.id, email=user.email)
    return {"Authorization": f"Bearer {token}"}
