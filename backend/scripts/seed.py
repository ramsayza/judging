"""Seed demo data: a platform admin (global, not a member of any org), one
organization with two organizers and two judges, one event with three
classes, and contracts showing each lifecycle stage."""

from datetime import date, datetime, timedelta

from app.db import SessionLocal
from app.models import (
    ClassAllocation,
    Contract,
    ContractStatus,
    Event,
    EventClass,
    Membership,
    MembershipRole,
    MembershipStatus,
    Organization,
    User,
)


def get_or_create_user(db, email: str, name: str, *, is_platform_admin: bool = False) -> User:
    user = db.query(User).filter(User.email == email).one_or_none()
    if user is None:
        user = User(email=email, name=name, is_platform_admin=is_platform_admin)
        db.add(user)
        db.flush()
    return user


def main() -> None:
    db = SessionLocal()

    org = db.query(Organization).filter(Organization.slug == "demo-club").one_or_none()
    if org is not None:
        print("Demo org already seeded (slug 'demo-club'); skipping.")
        return

    # A platform admin is global and, deliberately, not a member of any
    # org -- demonstrates that global admin doesn't grant automatic access
    # to any individual org's contracts.
    get_or_create_user(db, "platform-admin@example.com", "Platform Pat", is_platform_admin=True)

    org = Organization(name="Demo Agility Club", slug="demo-club")
    db.add(org)
    db.flush()

    # organizer is now the highest-privileged role within an org -- what used
    # to be a separate org-admin role has folded into it.
    admin = get_or_create_user(db, "admin@example.com", "Admin Alice")
    organizer = get_or_create_user(db, "organizer@example.com", "Organizer Olivia")
    judge1 = get_or_create_user(db, "judge1@example.com", "Judge Jill")
    judge2 = get_or_create_user(db, "judge2@example.com", "Judge Jack")

    db.add_all(
        [
            Membership(user_id=admin.id, organization_id=org.id, role=MembershipRole.organizer, status=MembershipStatus.active),
            Membership(user_id=organizer.id, organization_id=org.id, role=MembershipRole.organizer, status=MembershipStatus.active),
            Membership(user_id=judge1.id, organization_id=org.id, role=MembershipRole.judge, status=MembershipStatus.active),
            Membership(user_id=judge2.id, organization_id=org.id, role=MembershipRole.judge, status=MembershipStatus.active),
        ]
    )
    db.flush()

    event = Event(
        organization_id=org.id,
        name="Spring Championship 2026",
        venue="County Showground",
        start_date=date.today() + timedelta(days=30),
        end_date=date.today() + timedelta(days=31),
        created_by_user_id=organizer.id,
    )
    db.add(event)
    db.flush()

    novice = EventClass(event_id=event.id, name="Novice Jumping", level="Novice", discipline="Jumping")
    grade3 = EventClass(event_id=event.id, name="Grade 3 Agility", level="Grade 3", discipline="Agility")
    grade7 = EventClass(event_id=event.id, name="Grade 7 Agility", level="Grade 7", discipline="Agility")
    db.add_all([novice, grade3, grade7])
    db.flush()

    now = datetime.utcnow()

    # judge1: fully appointed and allocated to two classes (including co-judging grade3 with judge2)
    contract1 = Contract(
        event_id=event.id,
        judge_user_id=judge1.id,
        organization_id=org.id,
        invited_by_user_id=organizer.id,
        invited_at=now,
        status=ContractStatus.appointed,
        responded_at=now,
        appointed_at=now,
    )
    # judge2: only invited, awaiting response
    contract2 = Contract(
        event_id=event.id,
        judge_user_id=judge2.id,
        organization_id=org.id,
        invited_by_user_id=organizer.id,
        invited_at=now,
        status=ContractStatus.invitation,
    )
    db.add_all([contract1, contract2])
    db.flush()

    db.add_all(
        [
            ClassAllocation(contract_id=contract1.id, event_class_id=novice.id),
            ClassAllocation(contract_id=contract1.id, event_class_id=grade3.id),
        ]
    )
    db.commit()

    print("Seeded 'Demo Agility Club' (slug: demo-club):")
    print("  platform-admin@example.com - platform admin (global, no org membership)")
    print("  admin@example.com     - organizer")
    print("  organizer@example.com - organizer")
    print("  judge1@example.com    - judge (appointed, allocated to Novice Jumping + Grade 3 Agility)")
    print("  judge2@example.com    - judge (invitation pending response)")
    print("Use POST /api/v1/auth/dev-login with any of the above emails to obtain a token (ENVIRONMENT=development only).")


if __name__ == "__main__":
    main()
