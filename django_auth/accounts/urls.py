from django.urls import path
from .views import (
    RegisterView, MeView, AdminOnlyView, HRView,
    EmployeeDashboardView, UserListView, UserDetailView,
    LDAPUserListView, LDAPImportUserView, LDAPLoginView,
    HRUserDeleteView,
)
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

urlpatterns = [
    path('register/',        RegisterView.as_view(),          name='register'),
    path('login/',           LDAPLoginView.as_view(),         name='login'),
    path('token/refresh/',   TokenRefreshView.as_view(),      name='token_refresh'),
    path('me/',              MeView.as_view(),                name='me'),
    path('users/',           UserListView.as_view(),          name='user-list'),
    path('users/<int:pk>/',  UserDetailView.as_view(),        name='user-detail'),
    path('ldap/users/',      LDAPUserListView.as_view(),      name='ldap-users'),
    path('ldap/import/',     LDAPImportUserView.as_view(),    name='ldap-import'),
    path('admin-only/',      AdminOnlyView.as_view(),         name='admin_only'),
    path('hr-only/',         HRView.as_view(),                name='hr_only'),
    path('employee/',        EmployeeDashboardView.as_view(), name='employee_dashboard'),
    path("users/<int:pk>/hr-delete/", HRUserDeleteView.as_view(), name="hr-user-delete"),
]
