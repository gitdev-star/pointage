# from django.urls import path, include
# from rest_framework.routers import DefaultRouter
# from .views import (
#     FactoryViewSet, DepartmentViewSet, EmployeeViewSet, SectionViewSet,
#     WorkScheduleViewSet,
#     cached_factories, cached_departments, employee_export,
# )

# router = DefaultRouter()

# router.register(r"work-schedules", WorkScheduleViewSet,        basename="work-schedules")
# router.register("factories",       FactoryViewSet,             basename="factory")
# router.register("departments",     DepartmentViewSet,          basename="department")
# router.register("sections",        SectionViewSet,             basename="section")
 #router.register("",                EmployeeViewSet,            basename="employee")

# urlpatterns = [
#     path("export/",              employee_export,    name="employee-export"),
#     path("factories/cached/",   cached_factories,   name="factories-cached"),
#     path("departments/cached/", cached_departments, name="departments-cached"),
#     path("", include(router.urls)),
# ]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FactoryViewSet, DepartmentViewSet, EmployeeViewSet, SectionViewSet,
    WorkScheduleViewSet, ClassificationViewSet, PosteViewSet, cached_classifications,
    cached_factories, cached_departments, employee_export, TransportListViewSet
)

sub_router = DefaultRouter()
sub_router.register(r"work-schedules",  WorkScheduleViewSet,   basename="work-schedules")
sub_router.register(r"factories",       FactoryViewSet,        basename="factory")
sub_router.register(r"departments",     DepartmentViewSet,     basename="department")
sub_router.register(r"sections",        SectionViewSet,        basename="section")
sub_router.register(r"classifications", ClassificationViewSet, basename="classification")  # ← ajouter
sub_router.register(r"postes",          PosteViewSet,          basename="poste")
sub_router.register(r"transport-lists", TransportListViewSet,  basename="transport-lists")
sub_router.register(r"",                EmployeeViewSet,       basename="employee")


urlpatterns = [
    path("export/",             employee_export,    name="employee-export"),
    path("factories/cached/",   cached_factories,   name="factories-cached"),
    path("departments/cached/", cached_departments, name="departments-cached"),
    path("classifications/cached/", cached_classifications,   name="classifications-cached"),
   
    path("", include(sub_router.urls)),
]
