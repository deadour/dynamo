from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Exercise
from .serializers import ExerciseSerializer
class ExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSerializer; permission_classes = [IsAuthenticated]; http_method_names = ["get", "post"]
    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return Exercise.objects.none()
        q = Exercise.objects.filter(active=True).filter(is_custom=False) | Exercise.objects.filter(active=True, created_by=self.request.user)
        params = self.request.query_params
        if params.get("search"): q = q.filter(name__icontains=params["search"])
        if params.get("category"): q = q.filter(category__iexact=params["category"])
        if params.get("equipment"): q = q.filter(equipment__iexact=params["equipment"])
        return q.order_by("name").distinct()
    def perform_create(self, serializer): serializer.save(created_by=self.request.user, is_custom=True, source="custom")
