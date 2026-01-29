## Convenience Makefile for local development with Docker Compose

.PHONY: db-up migrate app-up compose-up compose-down logs

db-up:
	docker compose up -d db

migrate:
	docker compose run --rm migrate

app-up:
	docker compose up app

compose-up:
	docker compose up -d

compose-down:
	docker compose down

logs:
	docker compose logs -f
