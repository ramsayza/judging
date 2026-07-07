# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A multi-tenant portal for agility clubs ("organizations") to book judges for
competitions. Judges sign in with Google or Facebook, get invited to events,
and progress through a contract lifecycle:

```
invitation -> accepted -> appointed -> complete
           \-> declined            \-> cancelled
```

As part of a contract, judges are allocated specific competition classes
within an event (a class can be co-judged by more than one judge).

Roles are per-organization (`Membership.role`), not global: the same person
can be a Judge in one club and an Organizer in another.

- **Judge** — receives invitations, accepts/declines them, views appointed
  contracts and class allocations.
- **Organizer** — creates events and classes, invites judges, manages
  allocations, progresses contracts through their lifecycle.
- **Admin** — org-level admin; superset of Organizer, plus manages
  organization membership (approves join requests, promotes/demotes roles).

## Stack

- **Frontend**: Next.js (App Router) + NextAuth.js (Google + Facebook OAuth)
- **Backend**: FastAPI + SQLAlchemy + Alembic
- **Database**: MySQL 8
- **Local dev**: Docker Compose

## Commands

```bash
cp .env.example .env       # first-time setup; see auth notes below
make up                    # start MySQL + run migrations + start backend (8000) + frontend (3000)
make logs                  # tail all service logs
make migrate               # (re-)apply migrations without starting the app
make revision m="message"  # autogenerate a new Alembic migration
make seed                  # seed demo org/users/event/contracts
make test                  # run migrations, then the backend pytest suite
make down                  # stop the stack
```

To run a single backend test (once the stack is up):

```bash
docker compose run --rm backend pytest tests/test_contract_lifecycle.py -k accept
```

There is no frontend test suite or lint command configured yet.

## Auth architecture

This is the part most likely to trip up changes — it spans both services:

- NextAuth (frontend) is the identity provider (Google/Facebook OAuth, plus a
  dev-only Credentials provider). It never talks to the database directly.
- On sign-in, NextAuth's `jwt` callback (`frontend/src/lib/auth.ts`) calls the
  backend server-to-server at `/api/v1/auth/upsert` (protected by
  `X-Internal-Secret`, see `verify_internal_secret` in
  `backend/app/api/deps.py`) to create/update the `User` row, then mints a
  short-lived (15 min) HS256 JWT itself (`mintApiToken`, shared secret
  `BACKEND_JWT_SECRET`) and refreshes it automatically within 5 minutes of
  expiry.
- Browser calls to the FastAPI backend send that JWT as a bearer token
  (`useApiClient` in `frontend/src/lib/apiClient.ts`); the backend verifies it
  itself (`decode_api_token`) rather than trusting NextAuth's session.
- The dev-only `CredentialsProvider` (`id: "dev"`) and the backend's
  `/auth/dev-login` route are both gated on `ENVIRONMENT=development` /
  `NEXT_PUBLIC_ENVIRONMENT=development` and must never be reachable in a real
  deployment.
- `frontend/middleware.ts` only checks that a NextAuth session exists for
  `/org/*` and `/onboarding/*`; it does not know about org membership or
  role — that's enforced entirely on the backend.

## Backend request flow (`backend/app/api/deps.py`)

Every org-scoped route depends on `get_current_membership`, which resolves
the acting user's `Membership` for the `org_id` in the path/query **per
request** — role is never trusted from the JWT itself, so role changes
(promote/demote, membership approval) take effect immediately without a new
token. If no active membership exists, routes return `404` (not `403`) to
avoid leaking whether the org exists or whether the user has a
non-active/pending membership.

`require_role(...)` gates routes by role, with `organizer` implying `admin`
(`ROLE_IMPLIES` in `deps.py`). `judge` and `admin` are not implied by any
other role.

## Contract lifecycle (`backend/app/core/state_machine.py`)

This module is the single source of truth for valid contract transitions —
don't duplicate transition logic in routes or services. Each action
(`accept`, `decline`, `appoint`, `complete`, `cancel`) declares its valid
`from_statuses`, resulting `to_status`, and required actor (`judge` = must be
the invited judge; `organizer` = organizer/admin role). Invalid transitions
raise `ContractTransitionError`, which routes translate to `409 Conflict`;
permission is enforced separately via `require_role` at the route layer and
the judge-ownership check inside `validate_transition`.

## Backend layering

`api/routes/` (FastAPI routers, request/response only) → `services/`
(business logic, e.g. `contract_service.py`, `allocation_service.py`) →
`models/` (SQLAlchemy). `schemas/` holds Pydantic request/response models,
kept separate from `models/` (ORM). Alembic migrations live in
`backend/alembic/`; always generate them with `make revision m="..."` rather
than hand-writing, so they match actual model state.

## Testing conventions

`backend/tests/conftest.py` wraps each test in an outer transaction +
SAVEPOINT (the standard SQLAlchemy "join a session into an external
transaction" recipe) so that application code calling `session.commit()`
doesn't leak data between tests. Tests hit a real MySQL instance (via
`docker compose`), not mocks/SQLite — `make test` runs migrations first for
this reason.
