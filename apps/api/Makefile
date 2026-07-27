.PHONY: setup dev test lint format seed-demo clear-demo

setup:
	python -m venv .venv
	.venv/bin/pip install -r requirements.txt || .venv/Scripts/pip install -r requirements.txt

dev:
	uvicorn app.main:app --reload --port 8000

test:
	pytest -q

lint:
	ruff check app tests

format:
	ruff format app tests

seed-demo:
	python -m app.seed seed

clear-demo:
	python -m app.seed clear
