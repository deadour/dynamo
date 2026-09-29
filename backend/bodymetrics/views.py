from rest_framework import viewsets
from .models import BodyWeight
from .serializers import BodyWeightSerializer
class BodyWeightViewSet(viewsets.ModelViewSet):
    serializer_class=BodyWeightSerializer
    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return BodyWeight.objects.none()
        return BodyWeight.objects.filter(user=self.request.user)
    def perform_create(self,serializer): serializer.save(user=self.request.user)
