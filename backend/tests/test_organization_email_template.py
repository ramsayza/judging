import logging

from app.models import MembershipRole
from app.services.email_service import DEFAULT_INVITATION_SUBJECT_TEMPLATE
from tests.conftest import auth_header, make_event, make_membership, make_org, make_user


def test_get_returns_default_when_unset(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    r = client.get(f"/api/v1/organizations/{org.id}/email-template", headers=auth_header(organizer))
    assert r.status_code == 200
    body = r.json()
    assert body["subject"] is None
    assert body["body"] is None
    assert body["effective_subject"] == DEFAULT_INVITATION_SUBJECT_TEMPLATE
    assert "judge_name" in body["placeholders"]


def test_patch_valid_template_round_trips(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    r = client.patch(
        f"/api/v1/organizations/{org.id}/email-template",
        json={"subject": "Judge {event_name}!", "body": "Hi {judge_name}, from {organization_name}."},
        headers=auth_header(organizer),
    )
    assert r.status_code == 200
    assert r.json()["effective_subject"] == "Judge {event_name}!"

    r = client.get(f"/api/v1/organizations/{org.id}/email-template", headers=auth_header(organizer))
    assert r.json()["subject"] == "Judge {event_name}!"


def test_patch_unknown_placeholder_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    r = client.patch(
        f"/api/v1/organizations/{org.id}/email-template",
        json={"subject": "Hi {secret}", "body": "body"},
        headers=auth_header(organizer),
    )
    assert r.status_code == 422


def test_patch_unsafe_placeholder_rejected(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    r = client.patch(
        f"/api/v1/organizations/{org.id}/email-template",
        json={"subject": "Hi {0.__class__}", "body": "body"},
        headers=auth_header(organizer),
    )
    assert r.status_code == 422


def test_judge_cannot_access_email_template_routes(client, db_session):
    db = db_session
    org = make_org(db)
    judge = make_user(db, "judge@example.com")
    make_membership(db, judge, org, MembershipRole.judge)
    db.commit()

    assert client.get(f"/api/v1/organizations/{org.id}/email-template", headers=auth_header(judge)).status_code == 403
    assert (
        client.patch(
            f"/api/v1/organizations/{org.id}/email-template",
            json={"subject": None, "body": None},
            headers=auth_header(judge),
        ).status_code
        == 403
    )


def test_custom_template_used_when_inviting_judge(client, db_session, caplog):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    ev = make_event(db, org, organizer)
    db.commit()

    client.patch(
        f"/api/v1/organizations/{org.id}/email-template",
        json={"subject": "Custom subject", "body": "Custom body for {judge_name}"},
        headers=auth_header(organizer),
    )

    with caplog.at_level(logging.INFO, logger="app.email"):
        r = client.post(
            f"/api/v1/organizations/{org.id}/events/{ev.id}/contracts",
            json={"judge_email": "newjudge@example.com", "judge_name": "New Judge"},
            headers=auth_header(organizer),
        )
    assert r.status_code == 201
    assert any("Custom subject" in rec.message for rec in caplog.records)
    assert any("Custom body for New Judge" in rec.message for rec in caplog.records)

    caplog.clear()
    client.patch(
        f"/api/v1/organizations/{org.id}/email-template",
        json={"subject": None, "body": None},
        headers=auth_header(organizer),
    )
    with caplog.at_level(logging.INFO, logger="app.email"):
        r = client.post(
            f"/api/v1/organizations/{org.id}/events/{ev.id}/contracts",
            json={"judge_email": "anotherjudge@example.com", "judge_name": "Another Judge"},
            headers=auth_header(organizer),
        )
    assert r.status_code == 201
    assert any(DEFAULT_INVITATION_SUBJECT_TEMPLATE.format(event_name=ev.name) in rec.message for rec in caplog.records)
