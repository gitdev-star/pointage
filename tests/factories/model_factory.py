"""
Factory Boy factories for Django HR service.
Used to generate test data for HR models.
"""

import factory
from datetime import date, timedelta
from employees.models import Factory, Department, Section, Employee, WorkSchedule
from payroll.models import SalaryStructure, Payslip
from leaves.models import LeaveType, LeaveBalance, LeaveRequest
from accounts.models import HRProfile


class FactoryFactory(factory.django.DjangoModelFactory):
    """Factory for creating test Factory instances."""
    class Meta:
        model = Factory

    name = factory.Faker("company")
    code = factory.Sequence(lambda n: f"FAC{n:03d}")
    location = factory.Faker("city")
    is_active = True


class DepartmentFactory(factory.django.DjangoModelFactory):
    """Factory for creating test Department instances."""
    class Meta:
        model = Department

    name = factory.Faker("word")
    code = factory.Sequence(lambda n: f"DEPT{n:03d}")
    factory = factory.SubFactory(FactoryFactory)
    is_active = True


class SectionFactory(factory.django.DjangoModelFactory):
    """Factory for creating test Section instances."""
    class Meta:
        model = Section

    name = factory.Faker("word")
    code = factory.Sequence(lambda n: f"SEC{n:03d}")
    department = factory.SubFactory(DepartmentFactory)
    is_active = True


class EmployeeFactory(factory.django.DjangoModelFactory):
    """Factory for creating test Employee instances."""
    class Meta:
        model = Employee

    employee_id = factory.Sequence(lambda n: f"EMP{n:05d}")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    email = factory.Sequence(lambda n: f"emp{n}@company.com")
    phone = factory.Faker("phone_number")
    factory = factory.SubFactory(FactoryFactory)
    department = factory.SubFactory(DepartmentFactory, factory=factory.SelfAttribute("..factory"))
    section = factory.SubFactory(SectionFactory, department=factory.SelfAttribute("..department"))
    job_title = factory.Faker("job")
    contract_type = Employee.ContractType.PERMANENT
    hire_date = factory.LazyAttribute(lambda o: date.today() - timedelta(days=365))
    status = Employee.Status.ACTIVE


class WorkScheduleFactory(factory.django.DjangoModelFactory):
    """Factory for creating test WorkSchedule instances."""
    class Meta:
        model = WorkSchedule

    name = factory.Faker("word")
    employee = factory.SubFactory(EmployeeFactory)
    work_start = factory.LazyAttribute(lambda o: factory.datetime.time(7, 40))
    standard_start = factory.LazyAttribute(lambda o: factory.datetime.time(7, 30))
    standard_end = factory.LazyAttribute(lambda o: factory.datetime.time(16, 30))
    early_leave_limit = factory.LazyAttribute(lambda o: factory.datetime.time(16, 27))
    standard_work_hours = 8.0


class SalaryStructureFactory(factory.django.DjangoModelFactory):
    """Factory for creating test SalaryStructure instances."""
    class Meta:
        model = SalaryStructure

    name = factory.Faker("word")
    base_salary = 50000.00
    transport_allowance = 5000.00
    housing_allowance = 10000.00
    meal_allowance = 2000.00
    is_active = True


class PayslipFactory(factory.django.DjangoModelFactory):
    """Factory for creating test Payslip instances."""
    class Meta:
        model = Payslip

    employee = factory.SubFactory(EmployeeFactory)
    period_month = factory.LazyAttribute(lambda o: 1)
    period_year = factory.LazyAttribute(lambda o: 2024)
    structure = factory.SubFactory(SalaryStructureFactory)
    base_salary = 50000.00
    net_salary = 45000.00
    status = Payslip.Status.DRAFT


class LeaveTypeFactory(factory.django.DjangoModelFactory):
    """Factory for creating test LeaveType instances."""
    class Meta:
        model = LeaveType

    name = factory.Sequence(lambda n: f"Leave Type {n}")
    code = factory.Sequence(lambda n: f"LT{n:03d}")
    days_per_year = 20
    is_paid = True
    is_active = True


class LeaveBalanceFactory(factory.django.DjangoModelFactory):
    """Factory for creating test LeaveBalance instances."""
    class Meta:
        model = LeaveBalance

    employee = factory.SubFactory(EmployeeFactory)
    leave_type = factory.SubFactory(LeaveTypeFactory)
    year = factory.LazyAttribute(lambda o: 2024)
    entitled_days = 20
    used_days = 5


class LeaveRequestFactory(factory.django.DjangoModelFactory):
    """Factory for creating test LeaveRequest instances."""
    class Meta:
        model = LeaveRequest

    employee = factory.SubFactory(EmployeeFactory)
    leave_type = factory.SubFactory(LeaveTypeFactory)
    start_date = factory.LazyAttribute(lambda o: date.today() + timedelta(days=1))
    end_date = factory.LazyAttribute(lambda o: date.today() + timedelta(days=5))
    days_requested = 5
    status = LeaveRequest.Status.PENDING


class HRProfileFactory(factory.django.DjangoModelFactory):
    """Factory for creating test HRProfile instances."""
    class Meta:
        model = HRProfile

    auth_user_id = factory.Sequence(lambda n: n)
    username = factory.Sequence(lambda n: f"hruser{n}")
    email = factory.Sequence(lambda n: f"hruser{n}@company.com")
    job_title = "HR Manager"
    is_director = False
    factory = factory.SubFactory(FactoryFactory)
    is_active = True
