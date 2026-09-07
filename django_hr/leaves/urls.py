#==================================
#django_hr/leaves/urls.py
#==================================

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeaveTypeViewSet, LeaveBalanceViewSet, LeaveRequestViewSet, MaternityLeaveViewSet

router = DefaultRouter()
router.register("types",     LeaveTypeViewSet,     basename="leave-type")
router.register("balances",  LeaveBalanceViewSet,  basename="leave-balance")
router.register("requests",  LeaveRequestViewSet,  basename="leave-request")
router.register("maternity", MaternityLeaveViewSet, basename="maternity-leave")

urlpatterns = [path("", include(router.urls))]
