from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from accounts.admin import LDAPImportView

def health_check(request):
    return JsonResponse({"status": "healthy"})

urlpatterns = [
    path('admin/ldap-import/', LDAPImportView.as_view(), name='ldap-import'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('devices.urls')),
    path("health/", health_check),
]
