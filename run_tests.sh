#!/bin/bash

# HR Nexus Test Runner
# Helps run tests for different components

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HR Nexus Testing Suite${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo -e "${RED}ERROR: pytest is not installed${NC}"
    echo "Install testing dependencies with:"
    echo "  pip install -r requirements.txt"
    echo "  pip install -r django_auth/requirements.txt"
    echo "  pip install -r django_hr/requirements.txt"
    exit 1
fi

# Parse arguments
SERVICE=${1:-all}
TEST_TYPE=${2:-all}
COVERAGE=${3:-false}

case "$SERVICE" in
    fastapi)
        echo -e "${YELLOW}Running FastAPI tests...${NC}"
        if [ "$COVERAGE" == "cov" ]; then
            pytest tests/ --cov=app --cov-report=html --cov-report=term-missing -v
        else
            pytest tests/ -v
        fi
        ;;
    auth)
        echo -e "${YELLOW}Running Django Auth tests...${NC}"
        if [ "$COVERAGE" == "cov" ]; then
            pytest django_auth/tests/ --cov=accounts,devices --cov-report=html --cov-report=term-missing -v
        else
            pytest django_auth/tests/ -v
        fi
        ;;
    hr)
        echo -e "${YELLOW}Running Django HR tests...${NC}"
        if [ "$COVERAGE" == "cov" ]; then
            pytest django_hr/tests/ --cov=accounts,employees,payroll,leaves,alerts,sanctions,events,hr_events,reports,documents --cov-report=html --cov-report=term-missing -v
        else
            pytest django_hr/tests/ -v
        fi
        ;;
    all)
        echo -e "${YELLOW}Running all tests...${NC}"
        if [ "$COVERAGE" == "cov" ]; then
            pytest --cov --cov-report=html --cov-report=term-missing -v
        else
            pytest -v
        fi
        ;;
    unit)
        echo -e "${YELLOW}Running unit tests...${NC}"
        pytest -m unit -v
        ;;
    integration)
        echo -e "${YELLOW}Running integration tests...${NC}"
        pytest -m integration -v
        ;;
    help)
        echo "Usage: ./run_tests.sh [SERVICE] [TEST_TYPE] [COVERAGE]"
        echo ""
        echo "SERVICE:"
        echo "  fastapi       - Run FastAPI tests only"
        echo "  auth          - Run Django Auth tests only"
        echo "  hr            - Run Django HR tests only"
        echo "  all           - Run all tests (default)"
        echo "  unit          - Run all unit tests"
        echo "  integration   - Run all integration tests"
        echo ""
        echo "TEST_TYPE:"
        echo "  (optional) Specific test type"
        echo ""
        echo "COVERAGE:"
        echo "  cov           - Generate coverage report"
        echo ""
        echo "Examples:"
        echo "  ./run_tests.sh fastapi         # FastAPI tests"
        echo "  ./run_tests.sh auth cov        # Auth tests with coverage"
        echo "  ./run_tests.sh all cov         # All tests with coverage"
        exit 0
        ;;
    *)
        echo -e "${RED}Unknown service: $SERVICE${NC}"
        echo "Use './run_tests.sh help' for usage information"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Tests completed successfully${NC}"
else
    echo -e "${RED}✗ Tests failed${NC}"
    exit 1
fi
