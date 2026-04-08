from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import ClockerGroup, Clocker
from .serializers import ClockerGroupSerializer, ClockerSerializer

class ClockerGroupListAPI(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        groups = ClockerGroup.objects.all()
        serializer = ClockerGroupSerializer(groups, many=True)
        return Response(serializer.data)


class ClockerListAPI(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        clockers = Clocker.objects.select_related('group').filter(is_active=True)
        serializer = ClockerSerializer(clockers, many=True)
        return Response(serializer.data)
