from rest_framework import serializers
from .models import User
class UserSerializer(serializers.ModelSerializer):
    has_google = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "name", "avatar_url", "is_staff", "has_google", "has_password", "created_at"]
        read_only_fields = ["id", "email", "is_staff", "created_at"]

    def get_has_google(self, obj):
        return bool(obj.google_sub)

    def get_has_password(self, obj):
        return obj.has_usable_password()
