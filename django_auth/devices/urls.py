from django.urls import path
from .views import ClockerListAPI, ClockerGroupListAPI

urlpatterns = [
    path('clockers/', ClockerListAPI.as_view(), name='clockers-list'),
    path('groups/', ClockerGroupListAPI.as_view(), name='groups-list'),
]
