from rest_framework import serializers
from django.utils.text import slugify
from .models import Exercise
class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = "__all__"
        read_only_fields = ["id", "external_id", "created_by", "active", "source", "source_url", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False}}

    def validate(self, attrs):
        if not attrs.get("name", "").strip():
            raise serializers.ValidationError({"name": "El nombre es obligatorio."})
        if not attrs.get("slug"):
            attrs["slug"] = slugify(attrs["name"])
        return attrs
