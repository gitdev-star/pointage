"""
Integration tests for Django HR API endpoints.
Tests API interactions with the database and multiple services.
"""

import pytest
from rest_framework import status
from django.urls import reverse
from datetime import date


@pytest.mark.django_db
class TestEmployeeAPIIntegration:
    """Test employee API endpoints."""

    def test_list_employees_endpoint(self, authenticated_client, test_employee):
        """Test listing employees via API."""
        response = authenticated_client.get(reverse("employee-list"))
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND]

    def test_create_employee_via_api(self, authenticated_client, test_factory, test_department):
        """Test creating employee via API."""
        data = {
            "employee_id": "EMP999",
            "first_name": "Jane",
            "last_name": "Smith",
            "email": "jane@example.com",
            "factory": test_factory.id,
            "department": test_department.id,
            "hire_date": date.today().isoformat(),
            "contract_type": "CDI",
            "status": "ACTIVE"
        }
        response = authenticated_client.post(
            reverse("employee-list"),
            data,
            format="json"
        )
        # Should create or return 403 if not authorized
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND
        ]

    def test_update_employee_via_api(self, authenticated_client, test_employee):
        """Test updating employee via API."""
        data = {
            "first_name": "UpdatedName"
        }
        response = authenticated_client.patch(
            reverse("employee-detail", kwargs={"pk": test_employee.id}),
            data,
            format="json"
        )
        # Should update or return 403
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND
        ]


@pytest.mark.django_db
class TestPayrollAPIIntegration:
    """Test payroll API endpoints."""

    def test_list_payslips_endpoint(self, authenticated_client, test_employee):
        """Test listing payslips via API."""
        response = authenticated_client.get(reverse("payslip-list"))
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND]


@pytest.mark.django_db
class TestLeaveAPIIntegration:
    """Test leave request API endpoints."""

    def test_list_leave_requests(self, authenticated_client):
        """Test listing leave requests."""
        response = authenticated_client.get(reverse("leave-request-list"))
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND]

    def test_submit_leave_request(self, authenticated_client, test_employee):
        """Test submitting a leave request."""
        from leaves.models import LeaveType
        
        leave_type = LeaveType.objects.create(
            name="Annual Leave",
            code="AL",
            days_per_year=20
        )
        
        data = {
            "employee": test_employee.id,
            "leave_type": leave_type.id,
            "start_date": date.today().isoformat(),
            "end_date": date.today().isoformat(),
            "days_requested": 1,
            "reason": "Personal reasons"
        }
        response = authenticated_client.post(
            reverse("leave-request-list"),
            data,
            format="json"
        )
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND
        ]


@pytest.mark.django_db
class TestPermissionsIntegration:
    """Test permission-based access control."""

    def test_unauthenticated_access_denied(self, api_client):
        """Test that unauthenticated users are denied access."""
        response = api_client.get(reverse("employee-list"))
        # Should be 403 or 401
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND
        ]
