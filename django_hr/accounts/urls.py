# =====================================================
# PATH: pointage/django_hr/accounts/urls.py
# =====================================================

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HRProfileViewSet, MeHRView

router = DefaultRouter()
router.register("profiles", HRProfileViewSet, basename="hr-profile")

urlpatterns = [
    path("", include(router.urls)),
    path("me/", MeHRView.as_view(), name="hr-me"),
]
