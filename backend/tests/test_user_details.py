from app.models import EventClass, MembershipRole
from tests.conftest import auth_header, make_event, make_membership, make_org, make_user


def test_get_details_defaults(client, db_session):
    db = db_session
    judge = make_user(db, "judge@example.com")
    db.commit()

    r = client.get("/api/v1/me/details", headers=auth_header(judge))
    assert r.status_code == 200
    body = r.json()
    assert body["home_postcode"] is None
    assert body["class_restrictions"] == []
    # works with no org membership at all
    assert body["email"] == "judge@example.com"


def test_patch_details_round_trips(client, db_session):
    db = db_session
    judge = make_user(db, "judge@example.com")
    db.commit()

    r = client.patch(
        "/api/v1/me/details",
        json={
            "home_postcode": "AB1 2CD",
            "class_restrictions": [{"discipline": "Jumping", "level": "Grade 7"}, {"level": "Novice"}],
        },
        headers=auth_header(judge),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["home_postcode"] == "AB1 2CD"
    assert len(body["class_restrictions"]) == 2

    r = client.get("/api/v1/me/details", headers=auth_header(judge))
    assert r.json()["home_postcode"] == "AB1 2CD"
    assert r.json()["class_restrictions"][0] == {"discipline": "Jumping", "level": "Grade 7"}


def test_patch_rule_set_qualifications_round_trips(client, db_session):
    db = db_session
    judge = make_user(db, "judge@example.com")
    db.commit()

    r = client.patch(
        "/api/v1/me/details",
        json={
            "rule_set_qualifications": [
                {"rule_set": "RKC", "qualified_date": "2020-05-01"},
                {"rule_set": "Nexus", "qualified_date": "2022-03-15"},
            ]
        },
        headers=auth_header(judge),
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["rule_set_qualifications"]) == 2

    r = client.get("/api/v1/me/details", headers=auth_header(judge))
    quals = {q["rule_set"]: q["qualified_date"] for q in r.json()["rule_set_qualifications"]}
    assert quals == {"RKC": "2020-05-01", "Nexus": "2022-03-15"}


def test_patch_duplicate_rule_set_qualification_rejected(client, db_session):
    db = db_session
    judge = make_user(db, "judge@example.com")
    db.commit()

    r = client.patch(
        "/api/v1/me/details",
        json={
            "rule_set_qualifications": [
                {"rule_set": "RKC", "qualified_date": "2020-05-01"},
                {"rule_set": "RKC", "qualified_date": "2021-01-01"},
            ]
        },
        headers=auth_header(judge),
    )
    assert r.status_code == 422


def test_patch_details_empty_restriction_rejected(client, db_session):
    db = db_session
    judge = make_user(db, "judge@example.com")
    db.commit()

    r = client.patch(
        "/api/v1/me/details",
        json={"home_postcode": None, "class_restrictions": [{"discipline": None, "level": None}]},
        headers=auth_header(judge),
    )
    assert r.status_code == 422


def test_class_restriction_options_reflects_seeded_classes(client, db_session):
    db = db_session
    org = make_org(db)
    organizer = make_user(db, "organizer@example.com")
    judge = make_user(db, "judge@example.com")
    make_membership(db, organizer, org, MembershipRole.organizer)
    ev = make_event(db, org, organizer)
    db.add_all(
        [
            EventClass(event_id=ev.id, name="Novice Jumping", level="Novice", discipline="Jumping"),
            EventClass(event_id=ev.id, name="Grade 7 Agility", level="Grade 7", discipline="Agility"),
        ]
    )
    db.commit()

    r = client.get("/api/v1/me/class-restriction-options", headers=auth_header(judge))
    assert r.status_code == 200
    body = r.json()
    assert set(body["disciplines"]) >= {"Jumping", "Agility"}
    assert set(body["levels"]) >= {"Novice", "Grade 7"}
