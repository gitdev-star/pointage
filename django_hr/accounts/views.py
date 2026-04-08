from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import HRProfile
from .serializers import HRProfileSerializer
from .permissions import IsDirector, get_hr_profile, is_service_request
from .authentication import HRTokenAuthentication, ServiceAuthentication


class HRProfileViewSet(viewsets.ModelViewSet):
    queryset = HRProfile.objects.select_related("factory", "department").all()
    serializer_class = HRProfileSerializer
    authentication_classes = [ServiceAuthentication, HRTokenAuthentication]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["auth_user_id", "is_director", "is_active"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsDirector()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # django_admin deletion always allowed (comes via service key)
        if is_service_request(request):
            return super().destroy(request, *args, **kwargs)

        # HR Director trying to delete from HR frontend:
        # block only if it's the last director
        if instance.is_director:
            directors = HRProfile.objects.filter(is_director=True, is_active=True).count()
            if directors <= 1:
                return Response(
                    {"detail": "Impossible de supprimer le dernier Directeur RH."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return super().destroy(request, *args, **kwargs)


class MeHRView(APIView):
    authentication_classes = [HRTokenAuthentication]
    permission_classes     = [IsAuthenticated]

    def get(self, request):
        profile = get_hr_profile(request)
        if not profile:
            return Response(
                {
                    "detail":     "Aucun profil RH trouvé.",
                    "hr_user_id": request.hr_user_id,
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(HRProfileSerializer(profile).data)
