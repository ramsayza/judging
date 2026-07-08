from app.models import MembershipRole
from tests.conftest import auth_header, make_membership, make_org, make_user


def _create_event(client, org, organizer, **overrides):
    payload = {"name": "Spring Show", "start_date": "2026-08-01", "end_date": "2026-08-02"}
    payload.update(overrides)
    return client.post(f"/api/v1/organizations/{org.id}/events", json=payload, headers=auth_header(organizer))


def test_create_event_with_venue_details_round_trips(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    r = _create_event(client, org, organizer, venue_postcode="AB1 2CD", rule_set="RKC")
    assert r.status_code == 201
    body = r.json()
    assert body["venue_postcode"] == "AB1 2CD"
    assert body["rule_set"] == "RKC"


def test_create_event_without_venue_details_still_succeeds(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    r = _create_event(client, org, organizer)
    assert r.status_code == 201
    body = r.json()
    assert body["venue_postcode"] is None
    assert body["rule_set"] is None


def test_invalid_rule_set_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    r = _create_event(client, org, organizer, rule_set="NotARuleSet")
    assert r.status_code == 422


def test_archived_event_excluded_from_default_list_included_with_flag(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    event_id = _create_event(client, org, organizer).json()["id"]
    client.patch(
        f"/api/v1/organizations/{org.id}/events/{event_id}",
        json={"status": "archived"},
        headers=auth_header(organizer),
    )

    r = client.get(f"/api/v1/organizations/{org.id}/events", headers=auth_header(organizer))
    assert event_id not in [e["id"] for e in r.json()]

    r = client.get(
        f"/api/v1/organizations/{org.id}/events?include_archived=true", headers=auth_header(organizer)
    )
    assert event_id in [e["id"] for e in r.json()]


def test_edit_event_updates_fields(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    event_id = _create_event(client, org, organizer).json()["id"]
    r = client.patch(
        f"/api/v1/organizations/{org.id}/events/{event_id}",
        json={"venue": "New Venue", "venue_postcode": "XY9 8ZZ", "rule_set": "Nexus"},
        headers=auth_header(organizer),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["venue"] == "New Venue"
    assert body["venue_postcode"] == "XY9 8ZZ"
    assert body["rule_set"] == "Nexus"
