from app.models import EventRuleSet, MembershipRole
from tests.conftest import auth_header, make_event, make_membership, make_org, make_user


def _make_platform_admin(db, email="platform-admin@example.com"):
    admin = make_user(db, email)
    admin.is_platform_admin = True
    db.commit()
    return admin


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


def test_non_admin_cannot_access_rule_set_copies(client, db_session):
    db = db_session
    regular_user = make_user(db, "regular@example.com")
    db.commit()

    assert client.get("/api/v1/admin/rule-set-copies", headers=auth_header(regular_user)).status_code == 403
    r = client.patch(
        "/api/v1/admin/rule-set-copies/RKC", json={"body": "x"}, headers=auth_header(regular_user)
    )
    assert r.status_code == 403


def test_platform_admin_can_crud_rule_set_copies(client, db_session):
    db = db_session
    admin = _make_platform_admin(db)

    r = client.get("/api/v1/admin/rule-set-copies", headers=auth_header(admin))
    assert r.status_code == 200
    assert len(r.json()) == 5

    r = client.patch(
        "/api/v1/admin/rule-set-copies/RKC",
        json={"body": "Standard RKC contract text."},
        headers=auth_header(admin),
    )
    assert r.status_code == 200
    assert r.json()["body"] == "Standard RKC contract text."


def test_org_creation_requires_platform_admin(client, db_session):
    db = db_session
    regular_user = make_user(db, "regular@example.com")
    db.commit()

    r = client.post(
        "/api/v1/onboarding/organizations",
        json={"name": "New Club", "slug": "new-club", "organizer_email": "organizer@example.com"},
        headers=auth_header(regular_user),
    )
    assert r.status_code == 403


def test_org_creation_names_organizer_not_admin(client, db_session):
    db = db_session
    admin = _make_platform_admin(db)

    r = client.post(
        "/api/v1/onboarding/organizations",
        json={
            "name": "New Club",
            "slug": "new-club",
            "organizer_email": "new-organizer@example.com",
            "organizer_name": "New Organizer",
        },
        headers=auth_header(admin),
    )
    assert r.status_code == 201
    org_id = r.json()["id"]

    from app.models import Membership, User

    # the platform admin themselves has no membership in the org they created
    admin_membership = (
        db.query(Membership)
        .filter(Membership.user_id == admin.id, Membership.organization_id == org_id)
        .one_or_none()
    )
    assert admin_membership is None

    organizer = db.query(User).filter(User.email == "new-organizer@example.com").one()
    organizer_membership = (
        db.query(Membership)
        .filter(Membership.user_id == organizer.id, Membership.organization_id == org_id)
        .one()
    )
    assert organizer_membership.role == MembershipRole.organizer


def test_effective_copy_fallback_order(client, db_session):
    db = db_session
    admin = _make_platform_admin(db)
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    ev.rule_set = EventRuleSet.rkc
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    # neither global nor event copy set -> empty
    r = client.get(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/contract-copy", headers=auth_header(judge)
    )
    assert r.json()["effective_body"] == ""

    # set the global RKC copy
    client.patch(
        "/api/v1/admin/rule-set-copies/RKC", json={"body": "Global RKC text"}, headers=auth_header(admin)
    )
    r = client.get(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/contract-copy", headers=auth_header(judge)
    )
    assert r.json()["effective_body"] == "Global RKC text"

    # event-level override wins over the global copy
    client.patch(
        f"/api/v1/organizations/{org.id}/events/{ev.id}",
        json={"contract_copy_override": "This event's custom copy"},
        headers=auth_header(organizer),
    )
    r = client.get(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/contract-copy", headers=auth_header(judge)
    )
    assert r.json()["effective_body"] == "This event's custom copy"


def test_sign_contract_copy_requires_accepted_status(client, db_session):
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
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/sign-contract-copy", headers=auth_header(judge)
    )
    assert r.status_code == 409


def test_sign_contract_copy_round_trips_and_rejects_resign(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    ev.contract_copy_override = "Please sign here"
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]
    client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept",
        json={"responses": {}},
        headers=auth_header(judge),
    )

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/sign-contract-copy", headers=auth_header(judge)
    )
    assert r.status_code == 200
    assert r.json()["contract_copy_signed_at"] is not None
    assert r.json()["contract_copy_signed_body"] == "Please sign here"

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/sign-contract-copy", headers=auth_header(judge)
    )
    assert r.status_code == 409


def test_appoint_blocked_until_signed_when_copy_configured(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    ev.contract_copy_override = "Please sign here"
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]
    client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept",
        json={"responses": {}},
        headers=auth_header(judge),
    )

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/appoint", headers=auth_header(organizer)
    )
    assert r.status_code == 409

    client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/sign-contract-copy", headers=auth_header(judge)
    )

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/appoint", headers=auth_header(organizer)
    )
    assert r.status_code == 200
    assert r.json()["status"] == "appointed"


def test_appoint_succeeds_without_signing_when_no_copy_configured(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]
    client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept",
        json={"responses": {}},
        headers=auth_header(judge),
    )

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/appoint", headers=auth_header(organizer)
    )
    assert r.status_code == 200
    assert r.json()["status"] == "appointed"
