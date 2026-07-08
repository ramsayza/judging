from app.models import MembershipRole
from tests.conftest import auth_header, make_event, make_membership, make_org, make_user


def test_class_number_auto_increments_and_ignores_client_value(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    ev = make_event(db, org, organizer)
    db.commit()

    r1 = client.post(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/classes",
        json={"name": "Class A", "class_number": 999},
        headers=auth_header(organizer),
    )
    assert r1.status_code == 201
    assert r1.json()["class_number"] == 1

    r2 = client.post(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/classes",
        json={"name": "Class B"},
        headers=auth_header(organizer),
    )
    assert r2.status_code == 201
    assert r2.json()["class_number"] == 2


def test_class_date_and_ring_position_round_trip(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    ev = make_event(db, org, organizer)
    db.commit()

    r = client.post(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/classes",
        json={"name": "Class A", "class_date": "2026-08-01", "ring": "1", "ring_position": 3},
        headers=auth_header(organizer),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["class_date"] == "2026-08-01"
    assert body["ring"] == "1"
    assert body["ring_position"] == 3
