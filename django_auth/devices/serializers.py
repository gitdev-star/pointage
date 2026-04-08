from rest_framework import serializers
from .models import ClockerGroup, Clocker

class ClockerGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClockerGroup
        fields = ['id', 'name', 'description']


class ClockerSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    
    class Meta:
        model = Clocker
        fields = ['id', 'name', 'group_name', 'specific_name', 'ip_address', 'port', 'is_active']
