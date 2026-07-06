from app.models import MembershipRole
from tests.conftest import auth_header, make_class, make_event, make_membership, make_org, make_user


def _invite(client, org, event, organizer, judge):
    return client.post(
        f"/api/v1/organizations/{org.id}/events/{event.id}/contracts",
        json={"judge_user_id": judge.id},
        headers=auth_header(organizer),
    )


def test_full_lifecycle_invitation_to_complete(client, db_session):
    db = db_session
    org = make_org(db)
    admin = make_user(db, "admin@example.com")
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, admin, org, MembershipRole.admin)
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    r = _invite(client, org, ev, organizer, judge)
    assert r.status_code == 201
    contract = r.json()
    assert contract["status"] == "invitation"
    contract_id = contract["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept", headers=auth_header(judge)
    )
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/appoint", headers=auth_header(organizer)
    )
    assert r.status_code == 200
    assert r.json()["status"] == "appointed"

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/complete", headers=auth_header(organizer)
    )
    assert r.status_code == 200
    assert r.json()["status"] == "complete"


def test_cannot_appoint_before_accepted(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/appoint", headers=auth_header(organizer)
    )
    assert r.status_code == 409


def test_decline_is_terminal(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/decline",
        json={"reason": "unavailable"},
        headers=auth_header(judge),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "declined"

    # any further transition on a terminal contract is rejected
    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept", headers=auth_header(judge)
    )
    assert r.status_code == 409


def test_only_invited_judge_can_accept(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge1 = make_user(db, "judge1@example.com")
    judge2 = make_user(db, "judge2@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge1, org, MembershipRole.judge)
    make_membership(db, judge2, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge1).json()["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept", headers=auth_header(judge2)
    )
    assert r.status_code == 403


def test_cancel_frees_allocations(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    cls = make_class(db, ev)
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]
    client.post(f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept", headers=auth_header(judge))

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/allocations",
        json={"event_class_id": cls.id},
        headers=auth_header(organizer),
    )
    assert r.status_code == 201

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/cancel",
        json={"reason": "no longer needed"},
        headers=auth_header(organizer),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"

    board = client.get(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/allocations", headers=auth_header(organizer)
    ).json()
    assert board == []


def test_duplicate_contract_for_same_event_and_judge_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    assert _invite(client, org, ev, organizer, judge).status_code == 201
    assert _invite(client, org, ev, organizer, judge).status_code == 409
