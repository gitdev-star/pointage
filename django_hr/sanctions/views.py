# =====================================================
# PATH: pointage/django_hr/sanctions/views.py
# =====================================================
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from accounts.permissions import HRPermission

from .models import SanctionType, Sanction
from .serializers import SanctionTypeSerializer, SanctionSerializer


class SanctionTypeViewSet(viewsets.ModelViewSet):
    # LICENCIEMENT is always last — sort by level then name, LICENCIEMENT forced to end
    queryset           = SanctionType.objects.all().order_by('level', 'name')
    serializer_class   = SanctionTypeSerializer
    permission_classes = [HRPermission]
    filter_backends    = [filters.SearchFilter, DjangoFilterBackend]
    filterset_fields   = ["is_active"]
    search_fields      = ["name", "code"]


class SanctionViewSet(viewsets.ModelViewSet):
    queryset = Sanction.objects.select_related(
        "employee", "employee__factory", "employee__department",
        "sanction_type"
    ).order_by("-date")
    serializer_class   = SanctionSerializer
    permission_classes = [HRPermission]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ["employee", "sanction_type", "status"]
    search_fields      = ["employee__last_name", "employee__first_name", "employee__employee_id"]
    ordering_fields    = ["date", "created_at"]

    def perform_create(self, serializer):
        sanction = serializer.save(created_by=self.request.user.id)

        # Licenciement -> terminate employee
        if sanction.sanction_type.code == "LICENCIEMENT":
            sanction.employee.status = "TERMINATED"
            sanction.employee.save(update_fields=["status"])

    @action(detail=False, methods=["get"],
            url_path="employee/(?P<employee_id>[^/.]+)")
    def by_employee(self, request, employee_id=None):
        """Full sanction history for one employee, ordered chronologically."""
        sanctions = (
            Sanction.objects
            .filter(employee_id=employee_id)
            .select_related("sanction_type")
            .order_by("date")
        )
        serializer = self.get_serializer(sanctions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Count of active sanctions grouped by type/level."""
        from django.db.models import Count
        data = (
            Sanction.objects
            .filter(status="ACTIVE")
            .values("sanction_type__code", "sanction_type__name",
                    "sanction_type__level", "sanction_type__color")
            .annotate(count=Count("id"))
            .order_by("sanction_type__level")
        )
        return Response(list(data))

    @action(detail=False, methods=["get"],
            url_path="next-level/(?P<employee_id>[^/.]+)")
    def next_level(self, request, employee_id=None):
        """Return the suggested next sanction type for an employee."""
        last = (
            Sanction.objects
            .filter(employee_id=employee_id, status="ACTIVE")
            .select_related("sanction_type")
            .order_by("-sanction_type__level")
            .first()
        )
        from .models import SanctionType
        if last is None:
            next_type = SanctionType.objects.filter(code="RAPPEL").first()
        else:
            current_level = last.sanction_type.level
            next_type = (
                SanctionType.objects
                .filter(level=current_level + 1, is_active=True)
                .first()
            )
            if next_type is None:
                # Already at max level
                next_type = last.sanction_type

        if next_type is None:
            return Response({"detail": "Aucun type de sanction configure."}, status=404)

        return Response({
            "employee_id": employee_id,
            "next_level":  next_type.level,
            "next_code":   next_type.code,
            "next_label":  next_type.name,
        })
