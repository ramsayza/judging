.PHONY: up down build clean destroy logs migrate revision seed test

up:
	docker compose up

build:
	docker compose build

down:
	docker compose down

# Drops the frontend_node_modules named volume (stale after dependency
# changes, since it shadows whatever `npm install` puts in the image at
# build time -- see docker-compose.yml's frontend volumes) and rebuilds.
# Doesn't touch db_data; run `make up` afterwards.
clean:
	docker compose down
	docker volume rm -f $$(docker volume ls -q --filter name=frontend_node_modules) 2>/dev/null || true
	docker compose build


# Wipes containers, networks, AND every named volume (db_data,
# frontend_node_modules) -- destroys all DB data. Use before a clean
# end-to-end test run. Follow with `make up && make seed` to rebuild fresh.
destroy:
	docker compose down -v --remove-orphans

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
