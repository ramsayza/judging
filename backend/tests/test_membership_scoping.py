from app.models import MembershipRole
from tests.conftest import auth_header, make_event, make_membership, make_org, make_user


def test_user_with_no_membership_gets_404_not_403(client, db_session):
    db = db_session
    org = make_org(db)
    outsider = make_user(db, "outsider@example.com")
    db.commit()

    r = client.get(f"/api/v1/organizations/{org.id}/contracts", headers=auth_header(outsider))
    assert r.status_code == 404


def test_cross_org_isolation_for_events(client, db_session):
    db = db_session
    org_a = make_org(db, slug="org-a", name="Org A")
    org_b = make_org(db, slug="org-b", name="Org B")
    organizer_a = make_user(db, "organizer-a@example.com")
    organizer_b = make_user(db, "organizer-b@example.com")
    make_membership(db, organizer_a, org_a, MembershipRole.organizer)
    make_membership(db, organizer_b, org_b, MembershipRole.organizer)
    event_a = make_event(db, org_a, organizer_a, name="Org A's Event")
    db.commit()

    # organizer_b has no membership in org_a -- must not see org_a's event
    r = client.get(f"/api/v1/organizations/{org_a.id}/events/{event_a.id}", headers=auth_header(organizer_b))
    assert r.status_code == 404

    # organizer_a can see their own org's event
    r = client.get(f"/api/v1/organizations/{org_a.id}/events/{event_a.id}", headers=auth_header(organizer_a))
    assert r.status_code == 200


def test_judge_role_cannot_create_events(client, db_session):
    db = db_session
    org = make_org(db)
    judge = make_user(db, "judge@example.com")
    make_membership(db, judge, org, MembershipRole.judge)
    db.commit()

    r = client.post(
        f"/api/v1/organizations/{org.id}/events",
        json={"name": "x", "start_date": "2026-01-01", "end_date": "2026-01-02"},
        headers=auth_header(judge),
    )
    assert r.status_code == 403


def test_organizer_can_update_organization(client, db_session):
    # organizer is now the org's highest-privileged role -- what used to
    # require a separate org-admin now just requires organizer.
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    db.commit()

    r = client.patch(
        f"/api/v1/organizations/{org.id}", json={"name": "New name"}, headers=auth_header(organizer)
    )
    assert r.status_code == 200
    assert r.json()["name"] == "New name"


def test_judge_cannot_update_organization(client, db_session):
    db = db_session
    org = make_org(db)
    judge = make_user(db, "judge@example.com")
    make_membership(db, judge, org, MembershipRole.judge)
    db.commit()

    r = client.patch(
        f"/api/v1/organizations/{org.id}", json={"name": "New name"}, headers=auth_header(judge)
    )
    assert r.status_code == 403


def test_pending_membership_is_not_treated_as_active(client, db_session):
    from app.models import MembershipStatus

    db = db_session
    org = make_org(db)
    pending_user = make_user(db, "pending@example.com")
    make_membership(db, pending_user, org, MembershipRole.judge, status=MembershipStatus.pending)
    db.commit()

    r = client.get(f"/api/v1/organizations/{org.id}/contracts", headers=auth_header(pending_user))
    assert r.status_code == 404
