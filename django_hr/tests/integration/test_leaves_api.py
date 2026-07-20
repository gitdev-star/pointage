# tests/integration/test_leaves_api.py
"""
QE gap: leaves/ (LeaveRequest approve/reject workflow + MaternityLeave
lifecycle) had no dedicated coverage — only two smoke tests existed in
tests/test_api_integration.py (list/submit).

NOTE: leaves/views.py was moved onto HasModulePerm (require_perm) as part
of the sanctions/leaves/hr_events permission-consistency fix. The global
authenticated_client fixture in conftest.py does not attach an HRProfile,
so it now gets 403'd on every leaves/ endpoint. This file overrides
authenticated_client locally with an HR profile carrying full leaves
perms, scoped only to this file — it does not affect other test modules.
"""
import pytest
from datetime import date, timedelta
from unittest.mock import patch
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def authenticated_client(test_user, test_factory):
    """Override: authenticated client backed by an HR profile with full leaves perms."""
    from accounts.models import HRProfile
    HRProfile.objects.create(
        auth_user_id=test_user.id, username=test_user.username, email=test_user.email,
        job_title="HR Manager", factory=test_factory, is_director=False,
        perm_leaves_read=True, perm_leaves_write=True, perm_leaves_approve=True,
    )
    client = APIClient()
    refresh = RefreshToken.for_user(test_user)
    refresh["role"] = "HR"
    refresh["username"] = test_user.username
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def leave_type():
    from leaves.models import LeaveType
    return LeaveType.objects.create(
        name="Congé annuel", code="CA", days_per_year=20, is_paid=True,
    )


@pytest.fixture
def leave_balance(test_employee, leave_type):
    from leaves.models import LeaveBalance
    return LeaveBalance.objects.create(
        employee=test_employee, leave_type=leave_type, year=date.today().year,
        entitled_days=20, used_days=0, pending_days=5,
    )


@pytest.fixture
def pending_leave_request(test_employee, leave_type, leave_balance):
    from leaves.models import LeaveRequest
    return LeaveRequest.objects.create(
        employee=test_employee, leave_type=leave_type,
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=5),
        days_requested=5, status="PENDING",
    )


@patch("leaves.views.notify_leave_approved")
class TestLeaveApproval:

    def test_approve_updates_status_and_balance(
        self, mock_notify, authenticated_client, pending_leave_request, leave_balance
    ):
        resp = authenticated_client.post(
            f"/api/leaves/requests/{pending_leave_request.id}/approve_reject/",
            {"action": "approve"},
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "APPROVED"

        leave_balance.refresh_from_db()
        assert leave_balance.used_days == 5
        assert leave_balance.pending_days == 0
        mock_notify.assert_called_once()

    def test_approve_sets_approver_and_timestamp(
        self, mock_notify, authenticated_client, pending_leave_request, test_user
    ):
        resp = authenticated_client.post(
            f"/api/leaves/requests/{pending_leave_request.id}/approve_reject/",
            {"action": "approve"},
        )
        pending_leave_request.refresh_from_db()
        assert pending_leave_request.approved_by == test_user.id
        assert pending_leave_request.approved_at is not None

    def test_approve_missing_balance_row_does_not_error(
        self, mock_notify, authenticated_client, test_employee, leave_type
    ):
        from leaves.models import LeaveRequest
        lr = LeaveRequest.objects.create(
            employee=test_employee, leave_type=leave_type,
            start_date=date.today(), end_date=date.today() + timedelta(days=2),
            days_requested=2, status="PENDING",
        )
        # No LeaveBalance row exists for this employee/type/year
        resp = authenticated_client.post(
            f"/api/leaves/requests/{lr.id}/approve_reject/", {"action": "approve"},
        )
        assert resp.status_code == 200


@patch("leaves.views.notify_leave_rejected")
class TestLeaveRejection:

    def test_reject_sets_status_and_reason(self, mock_notify, authenticated_client, pending_leave_request):
        resp = authenticated_client.post(
            f"/api/leaves/requests/{pending_leave_request.id}/approve_reject/",
            {"action": "reject", "rejection_reason": "Effectif insuffisant"},
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "REJECTED"
        assert resp.data["rejection_reason"] == "Effectif insuffisant"

    def test_reject_does_not_touch_balance(
        self, mock_notify, authenticated_client, pending_leave_request, leave_balance
    ):
        authenticated_client.post(
            f"/api/leaves/requests/{pending_leave_request.id}/approve_reject/",
            {"action": "reject"},
        )
        leave_balance.refresh_from_db()
        assert leave_balance.used_days == 0
        assert leave_balance.pending_days == 5


class TestLeaveActionGuards:

    def test_cannot_action_already_approved_request(self, authenticated_client, test_employee, leave_type):
        from leaves.models import LeaveRequest
        lr = LeaveRequest.objects.create(
            employee=test_employee, leave_type=leave_type,
            start_date=date.today(), end_date=date.today() + timedelta(days=1),
            days_requested=1, status="APPROVED",
        )
        resp = authenticated_client.post(
            f"/api/leaves/requests/{lr.id}/approve_reject/", {"action": "approve"},
        )
        assert resp.status_code == 400

    def test_invalid_action_value_rejected(self, authenticated_client, pending_leave_request):
        resp = authenticated_client.post(
            f"/api/leaves/requests/{pending_leave_request.id}/approve_reject/",
            {"action": "maybe"},
        )
        assert resp.status_code == 400

    def test_start_date_after_end_date_rejected_on_create(self, authenticated_client, test_employee, leave_type):
        resp = authenticated_client.post("/api/leaves/requests/", {
            "employee": test_employee.id,
            "leave_type": leave_type.id,
            "start_date": str(date.today() + timedelta(days=5)),
            "end_date": str(date.today()),
            "days_requested": 1,
        })
        assert resp.status_code == 400


@patch("leaves.views.notify_maternity_created")
class TestMaternityLeaveLifecycle:

    def test_create_auto_calculates_legal_end_date(self, mock_notify, authenticated_client, test_employee):
        start = date.today()
        resp = authenticated_client.post("/api/leaves/maternity/", {
            "employee": test_employee.id,
            "expected_birth_date": str(start + timedelta(days=30)),
            "leave_start_date": str(start),
        })
        assert resp.status_code == 201
        assert resp.data["leave_end_date"] == str(start + timedelta(days=98))

    def test_mark_returned_sets_status_and_return_date(self, mock_notify, authenticated_client, test_employee):
        from leaves.models import MaternityLeave
        ml = MaternityLeave.objects.create(
            employee=test_employee, expected_birth_date=date.today(),
            leave_start_date=date.today() - timedelta(days=90),
            leave_end_date=date.today() + timedelta(days=8),
            status="ON_LEAVE", created_by=1,
        )
        with patch("leaves.views.notify_maternity_returned"):
            resp = authenticated_client.post(f"/api/leaves/maternity/{ml.id}/mark_returned/")
        assert resp.status_code == 200
        ml.refresh_from_db()
        assert ml.status == "RETURNED"
        assert ml.actual_return_date is not None

    def test_extend_requires_extended_end_date(self, mock_notify, authenticated_client, test_employee):
        from leaves.models import MaternityLeave
        ml = MaternityLeave.objects.create(
            employee=test_employee, expected_birth_date=date.today(),
            leave_start_date=date.today() - timedelta(days=90),
            leave_end_date=date.today() + timedelta(days=8),
            status="ON_LEAVE", created_by=1,
        )
        resp = authenticated_client.post(f"/api/leaves/maternity/{ml.id}/extend/", {})
        assert resp.status_code == 400

    def test_ending_soon_filters_by_seven_day_window(self, mock_notify, authenticated_client, test_employee):
        from leaves.models import MaternityLeave
        MaternityLeave.objects.create(
            employee=test_employee, expected_birth_date=date.today(),
            leave_start_date=date.today() - timedelta(days=90),
            leave_end_date=date.today() + timedelta(days=3),
            status="ON_LEAVE", created_by=1,
        )
        MaternityLeave.objects.create(
            employee=test_employee, expected_birth_date=date.today(),
            leave_start_date=date.today() - timedelta(days=90),
            leave_end_date=date.today() + timedelta(days=20),
            status="ON_LEAVE", created_by=1,
        )
        with patch("leaves.views.notify_maternity_ending_soon"):
            resp = authenticated_client.get("/api/leaves/maternity/ending_soon/")
        assert resp.status_code == 200
        assert len(resp.data) == 1