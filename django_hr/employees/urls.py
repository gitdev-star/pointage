from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FactoryViewSet, DepartmentViewSet, EmployeeViewSet, SectionViewSet,
    WorkScheduleViewSet,
    cached_factories, cached_departments, employee_export,
)

router = DefaultRouter()

router.register(r"work-schedules", WorkScheduleViewSet,        basename="work-schedules")
router.register("factories",       FactoryViewSet,             basename="factory")
router.register("departments",     DepartmentViewSet,          basename="department")
router.register("sections",        SectionViewSet,             basename="section")
router.register("",                EmployeeViewSet,            basename="employee")

urlpatterns = [
    path("export/",              employee_export,    name="employee-export"),
    path("factories/cached/",   cached_factories,   name="factories-cached"),
    path("departments/cached/", cached_departments, name="departments-cached"),
    path("", include(router.urls)),
]
