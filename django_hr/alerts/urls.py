from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CDDAlertViewSet,
    ExpiringCDDView,
    SendBulkAlertsView,
    CDDNotificationAssignmentViewSet,
    InAppNotificationViewSet,
    LateAlertAssignmentViewSet,
    MonthlyLateReportAssignmentViewSet,
    OvertimeLimitAssignmentViewSet,
)

router = DefaultRouter()
router.register("cdd",           CDDAlertViewSet,                  basename="cdd-alert")
router.register("notifications", CDDNotificationAssignmentViewSet, basename="cdd-notification")
router.register("inbox",         InAppNotificationViewSet,         basename="inbox")
router.register("late-notifications", LateAlertAssignmentViewSet, basename="late-notification")
router.register("monthly-hc-notifications", MonthlyLateReportAssignmentViewSet, basename="monthly-hc-notification")
router.register("overtime-limit-notifications", OvertimeLimitAssignmentViewSet, basename="overtime-limit-notification")

urlpatterns = [
    path("", include(router.urls)),
    path("expiring/",  ExpiringCDDView.as_view(),   name="expiring-cdd"),
    path("send-bulk/", SendBulkAlertsView.as_view(), name="send-bulk-alerts"),
]
