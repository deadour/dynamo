from rest_framework import serializers
from .models import BodyWeight
class BodyWeightSerializer(serializers.ModelSerializer):
    class Meta: model=BodyWeight; fields="__all__"; read_only_fields=["user","created_at"]
