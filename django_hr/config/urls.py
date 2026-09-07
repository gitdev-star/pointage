from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

def health_check(request):
    return JsonResponse({"status": "healthy"})

urlpatterns = [
    path("health/", health_check),
    path("admin/", admin.site.urls),
    path("api/token/",         TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(),   name="token_refresh"),
    path("api/accounts/",  include("accounts.urls")),
    path("api/employees/", include("employees.urls")),
    path("api/leaves/",    include("leaves.urls")),
    path("api/events/",    include("events.urls")),
    path("api/payroll/",   include("payroll.urls")),
    path("api/sanctions/", include("sanctions.urls")),
    path("api/hr-events/", include("hr_events.urls")),
    path("api/reports/",   include("reports.urls")),
    path("api/alerts/",    include("alerts.urls")),
    path("api/documents/", include("documents.urls")),
    path("api/audit/", include("audit_log.urls")),
    path( "api/recruitment/", include("recruitment.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
