"""
tests/unit/test_employee_signals.py

Tests for employees/signals.py:
  - clear_factory_cache / clear_department_cache / clear_section_cache
    (post_save + post_delete -> cache invalidation)
  - employee_termination_signal (post_save on Employee -> notify_resiliation
    when status transitions to TERMINATED with a motif)
"""

from unittest.mock import patch

import pytest
from django.core.cache import cache

from employees.models import Factory, Department, Section


pytestmark = pytest.mark.django_db


class TestCacheInvalidationSignals:
    def test_factory_save_clears_factories_cache(self):
        cache.set("factories_list", ["stale-data"], 60)
        Factory.objects.create(name="Triggers Signal")
        assert cache.get("factories_list") is None

    def test_factory_delete_clears_factories_cache(self, test_factory):
        cache.set("factories_list", ["stale-data"], 60)
        test_factory.delete()
        assert cache.get("factories_list") is None

    def test_department_save_clears_departments_cache(self, test_factory):
        cache.set("departments_list", ["stale-data"], 60)
        Department.objects.create(name="Triggers Dept Signal", factory=test_factory)
        assert cache.get("departments_list") is None

    def test_section_save_also_clears_departments_cache(self, test_department):
        # NOTE: as written, clear_section_cache invalidates "departments_list",
        # not a separate "sections_list" key — testing actual behavior, not
        # what might be intended.
        cache.set("departments_list", ["stale-data"], 60)
        Section.objects.create(name="Triggers Section Signal", department=test_department)
        assert cache.get("departments_list") is None

    def test_unrelated_cache_key_untouched_by_factory_save(self, test_factory):
        cache.set("departments_list", ["untouched"], 60)
        Factory.objects.create(name="Another Factory")
        # Only factories_list is cleared by the Factory signal, not departments_list.
        assert cache.get("departments_list") == ["untouched"]


class TestEmployeeTerminationSignal:
    @patch("employees.signals.notify_resiliation")
    def test_new_employee_does_not_notify(self, mock_notify, test_factory, test_department):
        from employees.models import Employee
        Employee.objects.create(
            employee_id="SIG001",
            first_name="New",
            last_name="Hire",
            factory=test_factory,
            department=test_department,
            status="ACTIVE",
        )
        mock_notify.assert_not_called()

    @patch("employees.signals.notify_resiliation")
    def test_update_to_terminated_with_motif_notifies(self, mock_notify, test_employee):
        test_employee.status = "TERMINATED"
        test_employee.motif_depart = "Fin de contrat"
        test_employee.save()
        mock_notify.assert_called_once()

    @patch("employees.signals.notify_resiliation")
    def test_update_to_terminated_without_motif_does_not_notify(self, mock_notify, test_employee):
        test_employee.status = "TERMINATED"
        test_employee.motif_depart = None
        test_employee.save()
        mock_notify.assert_not_called()

    @patch("employees.signals.notify_resiliation")
    def test_unrelated_update_does_not_notify(self, mock_notify, test_employee):
        test_employee.phone = "0341112233"
        test_employee.save()
        mock_notify.assert_not_called()

    @patch("employees.signals.notify_resiliation", side_effect=Exception("SMTP down"))
    def test_notify_failure_does_not_raise(self, mock_notify, test_employee):
        # The signal wraps the notify call in try/except, so a failure
        # (e.g. real email backend erroring) must not propagate and break save().
        test_employee.status = "TERMINATED"
        test_employee.motif_depart = "Fin de contrat"
        test_employee.save()  # should not raise
        mock_notify.assert_called_once()