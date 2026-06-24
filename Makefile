.PHONY: up down restart logs ps build pull

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose up -d --build

pull:
	docker compose pull

logs:
	docker compose logs -f

ps:
	docker compose ps

test-fast:
	python3 -m pytest -x -q

test-cov:
	python3 -m pytest -x -q --cov=app
