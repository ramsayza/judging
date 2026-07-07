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
- **Database**: Postgres 16
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

   This starts Postgres, runs migrations (`migrate` service, exits after
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

## Deploying to Heroku

Heroku binds one public URL to one web dyno, so the backend and frontend are
deployed as **two separate Heroku apps** that talk to each other over public
HTTPS (there's no private network between separate Heroku apps). Both are
deployed via Heroku Container Registry, reusing the existing Dockerfiles.

### Backend (`backend/`)

```bash
heroku create agility-portal-api
heroku addons:create heroku-postgresql:mini -a agility-portal-api

heroku config:set -a agility-portal-api \
  ENVIRONMENT=production \
  CORS_ORIGINS=https://agility-portal-web.herokuapp.com \
  FRONTEND_BASE_URL=https://agility-portal-web.herokuapp.com \
  BACKEND_JWT_SECRET=<generate-a-strong-secret> \
  INTERNAL_SERVICE_SECRET=<generate-a-strong-secret>
# DATABASE_URL is set automatically by the heroku-postgresql add-on
# (app/config.py rewrites its "postgres://" scheme to "postgresql+psycopg2://").

cd backend
heroku container:push web release -a agility-portal-api
heroku container:release web release -a agility-portal-api
```

The `release` process type (`Dockerfile.release`) runs `alembic upgrade head`
before the new `web` dyno (`Dockerfile`, binds `$PORT`) goes live — this
replaces the `migrate` one-off container from `docker-compose.yml`.

### Frontend (`frontend/`)

```bash
heroku create agility-portal-web

heroku config:set -a agility-portal-web \
  NEXTAUTH_SECRET=<generate-a-strong-secret> \
  NEXTAUTH_URL=https://agility-portal-web.herokuapp.com \
  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
  FACEBOOK_CLIENT_ID=... FACEBOOK_CLIENT_SECRET=... \
  BACKEND_JWT_SECRET=<same value as the backend app> \
  INTERNAL_SERVICE_SECRET=<same value as the backend app> \
  API_INTERNAL_URL=https://agility-portal-api.herokuapp.com \
  ENVIRONMENT=production NEXT_PUBLIC_ENVIRONMENT=production

# Also update the Google/Facebook OAuth app redirect URIs to
# https://agility-portal-web.herokuapp.com/api/auth/callback/{google,facebook}

cd frontend
heroku container:push web -a agility-portal-web \
  --arg NEXT_PUBLIC_API_BASE_URL=https://agility-portal-api.herokuapp.com,NEXT_PUBLIC_ENVIRONMENT=production
heroku container:release web -a agility-portal-web
```

`Dockerfile.web` (distinct from the dev-mode `Dockerfile` used by
`docker-compose.yml`) runs a production `next build` and `next start`.
`NEXT_PUBLIC_*` vars are inlined into the client bundle at build time, so they
must be passed as `--arg` build args (not just `heroku config:set`), and
`BACKEND_JWT_SECRET`/`INTERNAL_SERVICE_SECRET` must be identical on both apps
(the frontend mints an HS256 JWT the backend verifies — see the auth
architecture notes in `CLAUDE.md`). Never set `ENVIRONMENT` /
`NEXT_PUBLIC_ENVIRONMENT` to `development` in this deployment — that gates a
dev-only login bypass.

There are no background workers, cron jobs, or websockets in this app, so no
additional dyno types are needed beyond the two `web` processes.

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
