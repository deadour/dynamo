from rest_framework import serializers
from .models import BodyWeight
class BodyWeightSerializer(serializers.ModelSerializer):
    has_photo=serializers.SerializerMethodField()
    class Meta: model=BodyWeight; exclude=["photo","photo_type"]; read_only_fields=["user","created_at"]
    def get_has_photo(self,obj): return bool(obj.photo_type)
