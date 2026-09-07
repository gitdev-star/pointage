# from django_filters.rest_framework import DjangoFilterBackend
# from rest_framework import viewsets, filters
# from .models import AuditLog
# from .serializers import AuditLogSerializer


# class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
#     queryset = AuditLog.objects.all()  # ← retire select_related("user")
#     serializer_class = AuditLogSerializer
#     filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
#     filterset_fields = ["action", "model_name", "user_id"]
#     search_fields = ["object_repr", "username"]
#     ordering_fields = ["timestamp"]
#     ordering = ["-timestamp"]

#     def get_queryset(self):
#         qs = super().get_queryset()
#         date_from = self.request.query_params.get("date_from")
#         date_to = self.request.query_params.get("date_to")
#         if date_from:
#             qs = qs.filter(timestamp__gte=date_from)
#         if date_to:
#             qs = qs.filter(timestamp__lte=date_to)
#         return qs





from django.conf import settings

from django_filters.rest_framework import (
    DjangoFilterBackend,
)

from rest_framework import (
    filters,
    viewsets,
)

from .models import AuditLog
from .serializers import (
    AuditLogSerializer,
)


class AuditLogViewSet(
    viewsets.ReadOnlyModelViewSet
):
    queryset = (
        AuditLog.objects.all()
    )

    serializer_class = (
        AuditLogSerializer
    )

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = [
        "action",
        "app_label",
        "model_name",
        "user_id",
    ]

    search_fields = [
        "object_repr",
        "username",
        "app_label",
        "model_name",
    ]

    ordering_fields = [
        "timestamp",
    ]

    ordering = [
        "-timestamp",
    ]

    def get_queryset(self):
        queryset = (
            super().get_queryset()
        )

        # Masquer les applications
        # désactivées dans settings.py.
        applications_desactivees = (
            getattr(
                settings,
                "AUDIT_DISABLED_APPS",
                set(),
            )
        )

        if applications_desactivees:
            queryset = queryset.exclude(
                app_label__in=(
                    applications_desactivees
                )
            )

        date_from = (
            self.request
            .query_params
            .get("date_from")
        )

        date_to = (
            self.request
            .query_params
            .get("date_to")
        )

        if date_from:
            queryset = queryset.filter(
                timestamp__gte=date_from
            )
        if date_to:
            queryset = queryset.filter(
                timestamp__lte=date_to
            )

        return queryset