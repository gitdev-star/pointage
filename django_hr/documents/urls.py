from django.urls import path
from . import views

urlpatterns = [
    path("bulk-pdf/", views.bulk_documents_pdf, name="bulk_documents_pdf"),
    path("templates/", views.list_templates, name="list_templates"),
    path("<int:employee_id>/<str:doc_type>/", views.generate_document, name="generate_document"),
    path("<int:employee_id>/<str:doc_type>/pdf/", views.generate_document_pdf, name="generate_document_pdf"),
    path("bulk/", views.bulk_documents_zip, name="bulk_documents_zip"),
]
