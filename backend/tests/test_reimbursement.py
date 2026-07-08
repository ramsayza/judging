from decimal import Decimal

from app.models import MembershipRole
from app.services.reimbursement_service import haversine_miles
from tests.conftest import auth_header, make_event, make_membership, make_org, make_user

JUDGE_POSTCODE = "AB1 2CD"
VENUE_POSTCODE = "XY9 8ZZ"
JUDGE_COORDS = (52.5, -1.9)
VENUE_COORDS = (52.6, -2.1)


def _fake_geocode(postcode: str) -> tuple[float, float]:
    return {JUDGE_POSTCODE: JUDGE_COORDS, VENUE_POSTCODE: VENUE_COORDS}[postcode]


def _expected_return_miles() -> float:
    one_way = haversine_miles(*JUDGE_COORDS, *VENUE_COORDS)
    return round(one_way * 2, 1)


def _set_minimal_requirement(client, org, event, organizer):
    client.patch(
        f"/api/v1/organizations/{org.id}/events/{event.id}/contract-requirements",
        json={"fields": [{"key": "note", "label": "Note", "field_type": "text", "required": False}]},
        headers=auth_header(organizer),
    )


def _invite(client, org, event, organizer, judge):
    _set_minimal_requirement(client, org, event, organizer)
    return client.post(
        f"/api/v1/organizations/{org.id}/events/{event.id}/contracts",
        json={"judge_email": judge.email, "judge_name": judge.name},
        headers=auth_header(organizer),
    )


def test_create_event_defaults_cost_per_mile(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    r = client.post(
        f"/api/v1/organizations/{org.id}/events",
        json={"name": "Show", "start_date": "2026-08-01", "end_date": "2026-08-02"},
        headers=auth_header(organizer),
    )
    assert r.status_code == 201
    assert r.json()["cost_per_mile"] == "0.55"


def test_reimbursement_preview_requires_judge_postcode(client, db_session, monkeypatch):
    monkeypatch.setattr("app.services.reimbursement_service.geocode_postcode", _fake_geocode)
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    ev.venue_postcode = VENUE_POSTCODE
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.get(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/reimbursement-estimate",
        headers=auth_header(judge),
    )
    assert r.status_code == 422


def test_reimbursement_preview_returns_estimate(client, db_session, monkeypatch):
    monkeypatch.setattr("app.services.reimbursement_service.geocode_postcode", _fake_geocode)
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    judge.home_postcode = JUDGE_POSTCODE
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    ev.venue_postcode = VENUE_POSTCODE
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.get(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/reimbursement-estimate",
        headers=auth_header(judge),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["miles_return"] == _expected_return_miles()
    expected_amount = round(Decimal(str(_expected_return_miles())) * Decimal("0.55"), 2)
    assert Decimal(body["amount"]) == expected_amount
    assert body["capped"] is False


def test_reimbursement_cap_applied(client, db_session, monkeypatch):
    monkeypatch.setattr("app.services.reimbursement_service.geocode_postcode", _fake_geocode)
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    judge.home_postcode = JUDGE_POSTCODE
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    ev.venue_postcode = VENUE_POSTCODE
    ev.reimbursement_cap = Decimal("1.00")
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.get(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/reimbursement-estimate",
        headers=auth_header(judge),
    )
    assert r.status_code == 200
    assert Decimal(r.json()["amount"]) == Decimal("1.00")
    assert r.json()["capped"] is True


def test_accept_snapshots_reimbursement_estimate(client, db_session, monkeypatch):
    monkeypatch.setattr("app.services.reimbursement_service.geocode_postcode", _fake_geocode)
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    judge.home_postcode = JUDGE_POSTCODE
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    ev.venue_postcode = VENUE_POSTCODE
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept",
        json={"responses": {}},
        headers=auth_header(judge),
    )
    assert r.status_code == 200
    assert r.json()["reimbursement_estimate"] is not None
    assert r.json()["reimbursement_estimate"]["miles_return"] == _expected_return_miles()


def test_accept_without_judge_postcode_leaves_estimate_null(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    ev.venue_postcode = VENUE_POSTCODE
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept",
        json={"responses": {}},
        headers=auth_header(judge),
    )
    assert r.status_code == 200
    assert r.json()["reimbursement_estimate"] is None
