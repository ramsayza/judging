# Dog Agility Judge Portal

A multi-tenant portal for agility clubs ("organizations") to book judges for
competitions. Judges sign in with Google or Facebook, get invited to events,
and progress through a contract lifecycle:

```
invitation -> accepted -> appointed -> complete
           \-> declined            \-> cancelled
```

As part of a contract, judges are allocated specific competition classes
within an event (a class can be co-judged by more than one judge).

## Stack

- **Frontend**: Next.js (App Router) + NextAuth.js (Google + Facebook OAuth)
- **Backend**: FastAPI + SQLAlchemy + Alembic
- **Database**: MySQL 8
- **Local dev**: Docker Compose

## Roles

- **Judge** — receives invitations, accepts/declines them, views appointed
  contracts and class allocations.
- **Organizer** — creates events and classes, invites judges, manages
  allocations, progresses contracts through their lifecycle.
- **Admin** — org-level admin; superset of Organizer, plus manages
  organization membership (approves join requests, promotes/demotes roles).

A user's role is per-organization: the same person can be a Judge in one club
and an Organizer in another (see `Membership` in the data model).

## Local development

1. Copy the env template and fill in OAuth credentials (Google/Facebook
   console) and secrets:

   ```bash
   cp .env.example .env
   ```

   For local development without real OAuth apps, you can leave
   `GOOGLE_CLIENT_ID`/`FACEBOOK_CLIENT_ID` etc. blank and use the dev-only
   sign-in form on the home page instead (see below). `ENVIRONMENT` and
   `NEXT_PUBLIC_ENVIRONMENT` must both be `development` for this to appear —
   never set them to `development` in a real deployment.

2. Bring up the stack:

   ```bash
   make up
   ```

   This starts MySQL, runs migrations (`migrate` service, exits after
   applying them), then starts the FastAPI backend on
   [localhost:8000](http://localhost:8000) and the Next.js frontend on
   [localhost:3000](http://localhost:3000).

3. Seed demo data (one organization, an admin/organizer/two judges, one event
   with three classes, and contracts at a few different lifecycle stages):

   ```bash
   make seed
   ```

4. Open [localhost:3000](http://localhost:3000). With `ENVIRONMENT=development`,
   use the "Dev login" form with one of the seeded emails
   (`admin@example.com`, `organizer@example.com`, `judge1@example.com`,
   `judge2@example.com`) to sign in without going through Google/Facebook.

### Other useful commands

```bash
make logs                  # tail all service logs
make migrate               # (re-)apply migrations without starting the app
make revision m="message"  # autogenerate a new Alembic migration
make test                  # run the backend pytest suite
make down                  # stop the stack
```

## Manual verification walkthrough

With two browser sessions (or two browser profiles), one signed in as an
organizer and one as a judge:

1. Organizer creates an event and adds a few classes.
2. Organizer invites the judge — a `Contract` is created in `invitation`
   status.
3. Judge sees the invitation in their inbox and accepts it (`accepted`).
4. Organizer allocates classes to the judge (allocating the same class to a
   second judge is also allowed — co-judging).
5. Organizer appoints the judge (`appointed`), then later marks the contract
   complete (`complete`).
6. Negative checks: allocating the same judge to the same class twice is
   rejected (409); a user outside the organization gets 404 (not 403) when
   trying to access its data.

## Repository layout

```
backend/    FastAPI app, SQLAlchemy models, Alembic migrations, pytest suite
frontend/   Next.js app (App Router), NextAuth config, org-scoped pages
docker-compose.yml
```

See `backend/app/core/state_machine.py` for the single source of truth on
contract transitions, and `backend/app/api/deps.py` for how organization
membership and role are resolved per-request (never trusted from the auth
token itself, so role changes take effect immediately).
