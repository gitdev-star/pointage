.PHONY: test test-fast test-cov test-all test-unit test-integration test-fastapi test-auth test-hr help

help:
	@echo "HR Nexus Testing Commands"
	@echo "========================="
	@echo "make test              - Run all tests"
	@echo "make test-fast         - Run tests without coverage"
	@echo "make test-cov          - Run tests with coverage report"
	@echo "make test-all          - Run all tests with detailed output"
	@echo "make test-unit         - Run unit tests only"
	@echo "make test-integration  - Run integration tests only"
	@echo "make test-fastapi      - Run FastAPI tests"
	@echo "make test-auth         - Run Django Auth tests"
	@echo "make test-hr           - Run Django HR tests"
	@echo "make test-debug        - Run tests with debugging output"
	@echo "make test-pdb          - Run tests and drop into pdb on failure"
	@echo "make coverage-html     - Generate HTML coverage report"
	@echo "make lint              - Run linting checks"
	@echo "make format            - Format code with black"

test:
	pytest --cov --cov-report=term-missing

test-fast:
	@echo "Running FastAPI tests..."
	venv/bin/python3.11 -m pytest tests/ -q
	@echo "Running Django Auth tests..."
	docker exec django_auth bash -c "cd /app && python -m pytest tests/ -q"
	@echo "Running Django HR tests..."
	docker exec django_hr bash -c "cd /app && python -m pytest tests/ -q"

test-cov:
	@echo "Running FastAPI tests with coverage..."
	venv/bin/python3.11 -m pytest tests/ --cov=app --cov-report=html --cov-report=term-missing
	@echo "Running Django Auth tests with coverage..."
	docker exec django_auth bash -c "cd /app && python -m pytest tests/ --cov=accounts,devices --cov-report=term-missing"
	@echo "Running Django HR tests with coverage..."
	docker exec django_hr bash -c "cd /app && python -m pytest tests/ --cov=accounts,employees,payroll,leaves,alerts,sanctions,events,hr_events,reports,documents --cov-report=term-missing"
	@echo "All coverage reports done"

test-all:
	@echo "=== FastAPI ==="
	venv/bin/python3.11 -m pytest tests/ -vv --tb=short
	@echo "=== Django Auth ==="
	docker exec django_auth bash -c "cd /app && python -m pytest tests/ -vv --tb=short"
	@echo "=== Django HR ==="
	docker exec django_hr bash -c "cd /app && python -m pytest tests/ -vv --tb=short"

test-unit:
	@echo "=== FastAPI unit ==="
	venv/bin/python3.11 -m pytest tests/unit/ -v
	@echo "=== Django Auth unit ==="
	docker exec django_auth bash -c "cd /app && python -m pytest tests/unit/ -v"
	@echo "=== Django HR unit ==="
	docker exec django_hr bash -c "cd /app && python -m pytest tests/unit/ -v"

test-integration:
	@echo "=== FastAPI integration ==="
	venv/bin/python3.11 -m pytest tests/integration/ -v
	@echo "=== Django Auth integration ==="
	docker exec django_auth bash -c "cd /app && python -m pytest tests/integration/ -v"
	@echo "=== Django HR integration ==="
	docker exec django_hr bash -c "cd /app && python -m pytest tests/integration/ -v"

test-fastapi:
	venv/bin/python3.11 -m pytest tests/ -v

test-auth:
	docker exec django_auth bash -c "cd /app && python -m pytest tests/ -v"

test-hr:
	docker exec django_hr bash -c "cd /app && python -m pytest tests/ -v"

test-debug:
	@echo "=== FastAPI ==="
	venv/bin/python3.11 -m pytest tests/ -vv -s --tb=long
	@echo "=== Django Auth ==="
	docker exec django_auth bash -c "cd /app && python -m pytest tests/ -vv -s --tb=long"
	@echo "=== Django HR ==="
	docker exec django_hr bash -c "cd /app && python -m pytest tests/ -vv -s --tb=long"

test-pdb:
	pytest --pdb -v

coverage-html:
	pytest --cov --cov-report=html
	@command -v xdg-open >/dev/null && xdg-open htmlcov/index.html || \
	command -v open >/dev/null && open htmlcov/index.html || \
	echo "Open htmlcov/index.html in your browser"

lint:
	flake8 app tests django_auth django_hr --max-line-length=120 || true
	@echo "Linting complete"

format:
	black app tests django_auth/tests django_hr/tests --line-length=120 || true
	@echo "Formatting complete"

test-fastapi-cov:
	venv/bin/python3.11 -m pytest tests/ --cov=app --cov-report=html --cov-report=term-missing

test-auth-cov:
	docker exec django_auth bash -c "cd /app && python -m pytest tests/ --cov=accounts,devices --cov-report=term-missing"

test-hr-cov:
	docker exec django_hr bash -c "cd /app && python -m pytest tests/ --cov=accounts,employees,payroll,leaves,alerts,sanctions,events,hr_events,reports,documents --cov-report=term-missing"

watch:
	ptw --runner "pytest -v"

test-models:
	pytest -k "model" -v

test-views:
	pytest -k "view" -v

test-api:
	pytest -k "api" -v

test-slow:
	pytest -m slow -v

test-quick:
	pytest -m "not slow" -v
