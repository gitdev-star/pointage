# =====================================================
# PATH: pointage/django_hr/documents/urls.py
# =====================================================
from django.urls import path
from . import views

urlpatterns = [
    path("templates/", views.list_templates, name="list_templates"),
    path("<int:employee_id>/<str:doc_type>/", views.generate_document, name="generate_document"),
]
