from app.models import MembershipRole
from tests.conftest import auth_header, make_event, make_membership, make_org, make_user


def _invite(client, org, event, organizer, judge):
    return client.post(
        f"/api/v1/organizations/{org.id}/events/{event.id}/contracts",
        json={"judge_email": judge.email, "judge_name": judge.name},
        headers=auth_header(organizer),
    )


def test_invite_without_requirements_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    ev = make_event(db, org, organizer)
    db.commit()

    r = _invite(client, org, ev, organizer, judge)
    assert r.status_code == 409


def test_invite_after_setting_requirements_succeeds(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    ev = make_event(db, org, organizer)
    db.commit()

    client.patch(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/contract-requirements",
        json={"fields": [{"key": "note", "label": "Note", "field_type": "text", "required": False}]},
        headers=auth_header(organizer),
    )
    r = _invite(client, org, ev, organizer, judge)
    assert r.status_code == 201


def test_patch_requirements_duplicate_keys_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    ev = make_event(db, org, organizer)
    db.commit()

    r = client.patch(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/contract-requirements",
        json={
            "fields": [
                {"key": "size", "label": "Size A", "field_type": "text", "required": False},
                {"key": "size", "label": "Size B", "field_type": "text", "required": False},
            ]
        },
        headers=auth_header(organizer),
    )
    assert r.status_code == 422


def test_patch_requirements_select_without_options_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    ev = make_event(db, org, organizer)
    db.commit()

    r = client.patch(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/contract-requirements",
        json={"fields": [{"key": "shirt_size", "label": "Shirt size", "field_type": "select", "required": True}]},
        headers=auth_header(organizer),
    )
    assert r.status_code == 422


def test_judge_cannot_patch_requirements(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    r = client.patch(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/contract-requirements",
        json={"fields": []},
        headers=auth_header(judge),
    )
    assert r.status_code == 403


def test_judge_without_contract_cannot_get_requirements(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    r = client.get(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/contract-requirements",
        headers=auth_header(judge),
    )
    assert r.status_code == 404


def _set_shirt_size_requirement(client, org, event, organizer):
    return client.patch(
        f"/api/v1/organizations/{org.id}/events/{event.id}/contract-requirements",
        json={
            "fields": [
                {
                    "key": "shirt_size",
                    "label": "Shirt size",
                    "field_type": "select",
                    "required": True,
                    "options": ["S", "M", "L"],
                },
                {"key": "food_pref", "label": "Food preference", "field_type": "text", "required": False},
            ]
        },
        headers=auth_header(organizer),
    )


def test_judge_with_contract_can_get_requirements(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    assert _set_shirt_size_requirement(client, org, ev, organizer).status_code == 200
    _invite(client, org, ev, organizer, judge)

    r = client.get(
        f"/api/v1/organizations/{org.id}/events/{ev.id}/contract-requirements",
        headers=auth_header(judge),
    )
    assert r.status_code == 200
    assert r.json()["fields"][0]["key"] == "shirt_size"


def test_accept_missing_required_field_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    _set_shirt_size_requirement(client, org, ev, organizer)
    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept",
        json={"responses": {}},
        headers=auth_header(judge),
    )
    assert r.status_code == 422


def test_accept_invalid_select_option_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    _set_shirt_size_requirement(client, org, ev, organizer)
    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept",
        json={"responses": {"shirt_size": "XXL"}},
        headers=auth_header(judge),
    )
    assert r.status_code == 422


def test_accept_valid_responses_round_trip(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    _set_shirt_size_requirement(client, org, ev, organizer)
    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]

    r = client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept",
        json={"responses": {"shirt_size": "M", "food_pref": "Vegetarian"}},
        headers=auth_header(judge),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"
    assert r.json()["requirement_responses"] == {"shirt_size": "M", "food_pref": "Vegetarian"}

    r = client.get(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}", headers=auth_header(judge)
    )
    assert r.json()["requirement_responses"] == {"shirt_size": "M", "food_pref": "Vegetarian"}


def test_no_endpoint_exists_to_edit_responses_after_accept(client, db_session):
    """There is deliberately no PATCH route for a contract's requirement_responses --
    once accepted, they're locked for everyone. Confirmed by absence: trying any
    plausible edit path 404s/405s rather than succeeding."""
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    make_membership(db, judge, org, MembershipRole.judge)
    ev = make_event(db, org, organizer)
    db.commit()

    _set_shirt_size_requirement(client, org, ev, organizer)
    contract_id = _invite(client, org, ev, organizer, judge).json()["id"]
    client.post(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}/accept",
        json={"responses": {"shirt_size": "M"}},
        headers=auth_header(judge),
    )

    r = client.patch(
        f"/api/v1/organizations/{org.id}/contracts/{contract_id}",
        json={"requirement_responses": {"shirt_size": "L"}},
        headers=auth_header(organizer),
    )
    assert r.status_code in (404, 405)
