from app.models import MembershipRole
from tests.conftest import auth_header, make_class, make_event, make_membership, make_org, make_user


def _set_minimal_requirement(client, org, event, organizer):
    client.patch(
        f"/api/v1/organizations/{org.id}/events/{event.id}/contract-requirements",
        json={"fields": [{"key": "note", "label": "Note", "field_type": "text", "required": False}]},
        headers=auth_header(organizer),
    )


def _invite_and_accept(client, org, event, organizer, judge):
    _set_minimal_requirement(client, org, event, organizer)
    contract_id = client.post(
        f"/api/v1/organizations/{org.id}/events/{event.id}/contracts",
        json={"judge_email": judge.email, "judge_name": judge.name},
        headers=auth_header(organizer),
    ).json()["id"]
    client.post(f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept", headers=auth_header(judge))
    return contract_id


def test_co_judging_same_class_multiple_judges_allowed(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge1 = make_user(db, "judge1@example.com")
    judge2 = make_user(db, "judge2@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge1, org, MembershipRole.judge)
    make_membership(db, judge2, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    cls = make_class(db, ev)
    db.commit()

    contract1 = _invite_and_accept(client, org, ev, organizer, judge1)
    contract2 = _invite_and_accept(client, org, ev, organizer, judge2)

    r1 = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract1}/allocations",
        json={"event_class_id": cls.id},
        headers=auth_header(organizer),
    )
    r2 = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract2}/allocations",
        json={"event_class_id": cls.id},
        headers=auth_header(organizer),
    )
    assert r1.status_code == 201
    assert r2.status_code == 201


def test_duplicate_allocation_same_judge_same_class_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    cls = make_class(db, ev)
    db.commit()

    contract = _invite_and_accept(client, org, ev, organizer, judge)

    r1 = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract}/allocations",
        json={"event_class_id": cls.id},
        headers=auth_header(organizer),
    )
    r2 = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract}/allocations",
        json={"event_class_id": cls.id},
        headers=auth_header(organizer),
    )
    assert r1.status_code == 201
    assert r2.status_code == 409


def test_allocation_requires_matching_event(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev1 = make_event(db, org, organizer, name="Event 1")
    ev2 = make_event(db, org, organizer, name="Event 2")
    other_event_class = make_class(db, ev2, name="Class in a different event")
    db.commit()

    contract = _invite_and_accept(client, org, ev1, organizer, judge)

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract}/allocations",
        json={"event_class_id": other_event_class.id},
        headers=auth_header(organizer),
    )
    assert r.status_code == 409


def test_cannot_allocate_before_accepted(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    cls = make_class(db, ev)
    db.commit()

    _set_minimal_requirement(client, org, ev, organizer)
    contract_id = client.post(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/contracts",
        json={"judge_email": judge.email, "judge_name": judge.name},
        headers=auth_header(organizer),
    ).json()["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/allocations",
        json={"event_class_id": cls.id},
        headers=auth_header(organizer),
    )
    assert r.status_code == 409


def test_allocation_blocked_until_contract_copy_signed(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    ev.contract_copy_override = "Sample contract text"
    cls = make_class(db, ev)
    db.commit()

    contract_id = _invite_and_accept(client, org, ev, organizer, judge)

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/allocations",
        json={"event_class_id": cls.id},
        headers=auth_header(organizer),
    )
    assert r.status_code == 409

    client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/sign-contract-copy",
        headers=auth_header(judge),
    )

    r2 = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/allocations",
        json={"event_class_id": cls.id},
        headers=auth_header(organizer),
    )
    assert r2.status_code == 201


def test_allocate_by_ring_covers_all_classes_in_ring(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    cls1 = make_class(db, ev, name="Class 1")
    cls1.ring = "1"
    cls2 = make_class(db, ev, name="Class 2")
    cls2.ring = "1"
    cls3 = make_class(db, ev, name="Class 3")
    cls3.ring = "2"
    db.commit()

    contract_id = _invite_and_accept(client, org, ev, organizer, judge)

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/allocations/by-ring",
        json={"ring": "1"},
        headers=auth_header(organizer),
    )
    assert r.status_code == 201
    assert len(r.json()) == 2

    board = client.get(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/allocations",
        headers=auth_header(organizer),
    ).json()
    allocated_class_ids = {row["event_class_id"] for row in board}
    assert cls1.id in allocated_class_ids
    assert cls2.id in allocated_class_ids
    assert cls3.id not in allocated_class_ids

    r2 = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/allocations/by-ring",
        json={"ring": "1"},
        headers=auth_header(organizer),
    )
    assert r2.status_code == 201
    assert r2.json() == []


def test_cannot_modify_allocations_on_completed_contract(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    cls = make_class(db, ev)
    db.commit()

    contract_id = _invite_and_accept(client, org, ev, organizer, judge)
    allocation = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/allocations",
        json={"event_class_id": cls.id},
        headers=auth_header(organizer),
    ).json()

    client.post(f"/api/v1/organizations/{org.id}/contracts/{contract_id}/appoint", headers=auth_header(organizer))
    client.post(f"/api/v1/organizations/{org.id}/contracts/{contract_id}/complete", headers=auth_header(organizer))

    r = client.delete(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/allocations/{allocation['id']}",
        headers=auth_header(organizer),
    )
    assert r.status_code == 409
