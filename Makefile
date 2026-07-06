.PHONY: up down build logs migrate revision seed test

up:
	docker compose up

build:
	docker compose build

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose run --rm migrate alembic upgrade head

revision:
	docker compose run --rm migrate alembic revision --autogenerate -m "$(m)"

seed:
	docker compose run --rm backend python -m scripts.seed

test: migrate
	docker compose run --rm backend pytest
