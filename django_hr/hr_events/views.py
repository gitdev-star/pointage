#=========================================
#Django_hr/hr_events/views.py
#=========================================
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from accounts.permissions import require_perm
from .models import HREventType, HREvent
from .serializers import HREventTypeSerializer, HREventSerializer


class HREventTypeViewSet(viewsets.ModelViewSet):
    queryset           = HREventType.objects.all()
    serializer_class   = HREventTypeSerializer
    def get_permissions(self):
        write_actions = {"create", "update", "partial_update", "destroy"}
        perm_key = "hr_events_write" if self.action in write_actions else "hr_events_read"
        return [require_perm(perm_key)()]
    filter_backends    = [filters.SearchFilter, DjangoFilterBackend]
    filterset_fields   = ["category", "is_active"]
    search_fields      = ["name", "code"]


class HREventViewSet(viewsets.ModelViewSet):
    queryset = HREvent.objects.select_related(
        "employee", "employee__factory", "employee__department", "event_type"
    ).order_by("-start_date")
    serializer_class   = HREventSerializer
    def get_permissions(self):
        write_actions = {"create", "update", "partial_update", "destroy"}
        perm_key = "hr_events_write" if self.action in write_actions else "hr_events_read"
        return [require_perm(perm_key)()]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ["employee", "event_type", "status", "event_type__category"]
    search_fields      = ["employee__last_name", "employee__first_name", "employee__employee_id"]
    ordering_fields    = ["start_date", "created_at"]

    def perform_create(self, serializer):
        event = serializer.save(created_by=self.request.user.id)
        if event.event_type.affects_status and event.event_type.target_status:
            event.employee.status = event.event_type.target_status
            event.employee.save(update_fields=["status"])

    @action(detail=False, methods=["get"])
    def summary(self, request):
        from django.db.models import Count
        data = (
            HREvent.objects.filter(status="ACTIVE")
            .values("event_type__name", "event_type__code", "event_type__color", "event_type__category")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        return Response(list(data))
