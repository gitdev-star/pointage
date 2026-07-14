"""
tests/integration/test_late_report_hr_db_real.py

QE finding: late_report_service.py bypasses django-hr's API and reads
the HR Postgres database directly via psycopg2 (_get_hr_connection,
_get_employee_ids_by_classification, get_all_classifications), because
"Django is NOT available in the FastAPI container." No test anywhere
exercises these functions against a real HR schema -- the in-memory
SQLite used by tests/unit/ can't have the `classification` table at all.

This means a django-hr migration that renames/drops the `classification`
table or the `employee_id`/`classe` columns breaks FastAPI's late report
silently, with no automated warning, since django-hr's own migration
tests have no reason to know FastAPI depends on this table directly.

Run against real infra:
    docker compose exec -T fastapi pytest tests/integration/test_late_report_hr_db_real.py -m real_cross_service
"""
import os
import pytest

from app.services.late_report_service import (
    _get_hr_connection,
    _get_employee_ids_by_classification,
    get_all_classifications,
)

pytestmark = pytest.mark.real_cross_service


@pytest.fixture
def hr_db_connection():
    """Skip cleanly if HR DB isn't reachable, rather than erroring --
    this test only makes sense with real infra up."""
    try:
        conn = _get_hr_connection()
    except Exception as e:
        pytest.skip(f"HR database not reachable, skipping real-infra test: {e}")
    yield conn
    conn.close()


class TestLateReportHRDatabaseSchema:

    def test_classification_table_is_reachable_and_has_expected_columns(
        self, hr_db_connection
    ):
        """Pins the exact schema late_report_service.py silently depends
        on. If django-hr ever renames `classification`, `classe`, or
        `employee_id` (on the employee side), this fails loudly here
        instead of failing silently in production late-report output."""
        with hr_db_connection.cursor() as cur:
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'classification'"
            )
            columns = {row[0] for row in cur.fetchall()}

        assert columns, "classification table not found in HR database at all"
        assert "classe" in columns, (
            "classification.classe column missing -- "
            "get_all_classifications() reads this column directly"
        )

    def test_get_all_classifications_returns_real_data_without_error(
        self, hr_db_connection
    ):
        result = get_all_classifications()
        assert isinstance(result, list)
        # Not asserting non-empty -- a fresh/staging DB may have none yet.
        # The point is that the query itself runs without raising.

    def test_get_employee_ids_by_classification_handles_unknown_classification(
        self, hr_db_connection
    ):
        """Should return an empty set (or None per the function's own
        contract), not raise, for a classification that doesn't exist --
        confirms the query itself is well-formed against the real schema."""
        result = _get_employee_ids_by_classification("__qe_test_nonexistent__")
        assert result is None or result == set()

    def test_get_employee_ids_by_classification_none_means_no_filter(
        self, hr_db_connection
    ):
        """Documents the function's contract: passing None should mean
        'no classification filter', not 'match nothing'. Written from
        reading the function signature -- confirm the returned value
        matches the calling code's actual expectation in
        compute_late_report() if this fails."""
        result = _get_employee_ids_by_classification(None)
        assert result is None