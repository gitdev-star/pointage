from django.contrib import admin
from django.urls import path, include
from accounts.admin import LDAPImportView

urlpatterns = [
    path('admin/ldap-import/', LDAPImportView.as_view(), name='ldap-import'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('devices.urls')),
]
