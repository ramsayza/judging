from app.models import MembershipRole
from tests.conftest import auth_header, make_event, make_membership, make_org, make_user


def _invite(client, org, event, organizer, judge):
    return client.post(
        f"/api/v1/organizations/{org.id}/events/{event.id}/contracts",
        json={"judge_email": judge.email, "judge_name": judge.name},
        headers=auth_header(organizer),
    )


def test_my_contracts_aggregates_across_orgs_and_scopes_to_self(client, db_session):
    db = db_session
    org_a = make_org(db, slug="club-a", name="Club A")
    org_b = make_org(db, slug="club-b", name="Club B")
    organizer_a = make_user(db, "organizer-a@example.com")
    organizer_b = make_user(db, "organizer-b@example.com")
    judge = make_user(db, "judge@example.com")
    other_judge = make_user(db, "other-judge@example.com")
    make_membership(db, organizer_a, org_a, MembershipRole.organizer)
    make_membership(db, organizer_b, org_b, MembershipRole.organizer)
    ev_a = make_event(db, org_a, organizer_a, name="Event A")
    ev_b = make_event(db, org_b, organizer_b, name="Event B")
    db.commit()

    _invite(client, org_a, ev_a, organizer_a, judge)
    _invite(client, org_b, ev_b, organizer_b, judge)
    _invite(client, org_a, ev_a, organizer_a, other_judge)

    r = client.get("/api/v1/me/contracts", headers=auth_header(judge))
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    orgs_seen = {c["organization_name"] for c in body}
    assert orgs_seen == {"Club A", "Club B"}
    # never leaks another judge's contract
    assert all(c["organization_name"] != "" for c in body)


def test_my_contract_detail_requires_ownership(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    other_judge = make_user(db, "other-judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    ev = make_event(db, org, organizer)
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.get(f"/api/v1/me/contracts/{contract_id}", headers=auth_header(judge))
    assert r.status_code == 200
    assert r.json()["event_name"] == ev.name

    r = client.get(f"/api/v1/me/contracts/{contract_id}", headers=auth_header(other_judge))
    assert r.status_code == 404
