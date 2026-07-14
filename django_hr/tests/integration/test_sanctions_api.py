# tests/integration/test_sanctions_api.py
"""
QE gap: sanctions/ had zero dedicated tests. Covers the escalation
business logic (LICENCIEMENT auto-terminates employee), the MISE_PIED
date validation, and the by_employee/summary/next_level actions.
"""
import pytest
from datetime import date

pytestmark = pytest.mark.django_db


@pytest.fixture
def sanction_type_rappel():
    from sanctions.models import SanctionType
    return SanctionType.objects.get(code="RAPPEL")


@pytest.fixture
def sanction_type_mise_pied():
    from sanctions.models import SanctionType
    return SanctionType.objects.get(code="MISE_PIED")


@pytest.fixture
def sanction_type_licenciement():
    from sanctions.models import SanctionType
    return SanctionType.objects.get(code="LICENCIEMENT")


class TestSanctionTypeSeedData:
    """Locks in the seeded reference data other tests/business logic depend on."""

    def test_seed_contains_expected_codes(self):
        from sanctions.models import SanctionType
        codes = set(SanctionType.objects.values_list("code", flat=True))
        assert {"RAPPEL", "AVERT_1", "AVERT_2", "AVERT_3",
                "BLAME", "MISE_PIED", "LICENCIEMENT"}.issubset(codes)


class TestSanctionCreate:

    def test_create_requires_auth(self, api_client, test_employee, sanction_type_rappel):
        resp = api_client.post("/api/sanctions/", {
            "employee": test_employee.id,
            "sanction_type": sanction_type_rappel.id,
            "date": str(date.today()),
            "reason": "Retard répété",
        })
        assert resp.status_code == 401

    def test_create_requires_active_hr_profile(self, authenticated_client, test_employee, sanction_type_rappel):
        # authenticated_client has a valid JWT but NO HRProfile behind it
        resp = authenticated_client.post("/api/sanctions/", {
            "employee": test_employee.id,
            "sanction_type": sanction_type_rappel.id,
            "date": str(date.today()),
            "reason": "Retard répété",
        })
        assert resp.status_code == 403

    def test_create_sets_created_by_from_request(
        self, authenticated_client, hr_profile, test_employee, sanction_type_rappel, test_user
    ):
        resp = authenticated_client.post("/api/sanctions/", {
            "employee": test_employee.id,
            "sanction_type": sanction_type_rappel.id,
            "date": str(date.today()),
            "reason": "Retard répété",
        })
        assert resp.status_code == 201
        assert resp.data["created_by"] == test_user.id

    def test_licenciement_sanction_terminates_employee(
        self, authenticated_client, hr_profile, test_employee, sanction_type_licenciement
    ):
        assert test_employee.status == "ACTIVE"
        resp = authenticated_client.post("/api/sanctions/", {
            "employee": test_employee.id,
            "sanction_type": sanction_type_licenciement.id,
            "date": str(date.today()),
            "reason": "Faute grave",
        })
        assert resp.status_code == 201
        test_employee.refresh_from_db()
        assert test_employee.status == "TERMINATED"

    def test_non_licenciement_sanction_does_not_touch_employee_status(
        self, authenticated_client, hr_profile, test_employee, sanction_type_rappel
    ):
        authenticated_client.post("/api/sanctions/", {
            "employee": test_employee.id,
            "sanction_type": sanction_type_rappel.id,
            "date": str(date.today()),
            "reason": "Retard",
        })
        test_employee.refresh_from_db()
        assert test_employee.status == "ACTIVE"

    def test_mise_a_pied_requires_start_and_end_dates(
        self, authenticated_client, hr_profile, test_employee, sanction_type_mise_pied
    ):
        resp = authenticated_client.post("/api/sanctions/", {
            "employee": test_employee.id,
            "sanction_type": sanction_type_mise_pied.id,
            "date": str(date.today()),
            "reason": "Absence injustifiée",
        })
        assert resp.status_code == 400


class TestSanctionCustomActions:

    def test_by_employee_returns_chronological_history(
        self, authenticated_client, hr_profile, test_employee,
        sanction_type_rappel, sanction_type_mise_pied
    ):
        from sanctions.models import Sanction
        Sanction.objects.create(
            employee=test_employee, sanction_type=sanction_type_rappel,
            date=date(2024, 3, 1), reason="R1",
        )
        Sanction.objects.create(
            employee=test_employee, sanction_type=sanction_type_rappel,
            date=date(2024, 1, 1), reason="R2",
        )
        resp = authenticated_client.get(f"/api/sanctions/employee/{test_employee.id}/")
        assert resp.status_code == 200
        dates = [row["date"] for row in resp.data]
        assert dates == sorted(dates)  # oldest first, per view's .order_by("date")

    def test_summary_counts_active_only(
        self, authenticated_client, hr_profile, test_employee,
        sanction_type_rappel, sanction_type_mise_pied
    ):
        from sanctions.models import Sanction
        Sanction.objects.create(
            employee=test_employee, sanction_type=sanction_type_rappel,
            date=date.today(), reason="active one", status="ACTIVE",
        )
        Sanction.objects.create(
            employee=test_employee, sanction_type=sanction_type_rappel,
            date=date.today(), reason="cancelled one", status="CANCELLED",
        )
        resp = authenticated_client.get("/api/sanctions/summary/")
        assert resp.status_code == 200
        row = next(r for r in resp.data if r["sanction_type__code"] == "RAPPEL")
        assert row["count"] == 1

    def test_next_level_with_no_history_falls_back_to_configured_default(
        self, authenticated_client, hr_profile, test_employee
    ):
        """
        QE finding: next_level()'s no-history branch looks up
        SanctionType.objects.filter(code="RAO") — but the seeded data
        uses code "RAPPEL", not "RAO" (see 0002_seed_sanctiontypes.py).
        For a brand-new employee this returns HTTP 404 instead of
        suggesting the first escalation step. Marked xfail(strict=True)
        so it flips red the day someone fixes the code mismatch —
        at which point drop the xfail and assert next_code == "RAPPEL".
        """
        resp = authenticated_client.get(f"/api/sanctions/next-level/{test_employee.id}/")
        assert resp.status_code == 200
        assert resp.data["next_code"] == "RAPPEL"

    def test_next_level_escalates_from_existing_active_sanction(
        self, authenticated_client, hr_profile, test_employee,
        sanction_type_rappel, sanction_type_mise_pied
    ):
        from sanctions.models import Sanction
        Sanction.objects.create(
            employee=test_employee, sanction_type=sanction_type_rappel,
            date=date.today(), reason="first strike", status="ACTIVE",
        )
        resp = authenticated_client.get(f"/api/sanctions/next-level/{test_employee.id}/")
        assert resp.status_code == 200
        assert resp.data["next_level"] == sanction_type_rappel.level + 1