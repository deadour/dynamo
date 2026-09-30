from django.db.models import Count, Max, Q
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from bodymetrics.models import BodyWeight
from bodymetrics.serializers import BodyWeightSerializer
from workouts.models import Workout
from workouts.serializers import WorkoutSerializer

from .models import User


def user_row(user):
    return {
        "id": str(user.id), "email": user.email, "name": user.name, "avatar_url": user.avatar_url,
        "is_staff": user.is_staff, "is_active": user.is_active, "created_at": user.created_at,
        "last_login": user.last_login, "auth": "google" if user.google_sub else "email",
        "workouts": getattr(user, "workout_count", None), "last_workout": getattr(user, "last_workout", None),
    }


class AdminUserViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Panel de administración: solo para usuarios con is_staff. Las fotos de progreso no se exponen."""
    permission_classes = [IsAdminUser]
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        qs = User.objects.annotate(workout_count=Count("workouts", distinct=True), last_workout=Max("workouts__started_at")).order_by("-created_at")
        term = self.request.query_params.get("search")
        return qs.filter(Q(email__icontains=term) | Q(name__icontains=term)) if term else qs

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response([user_row(u) for u in page])

    def retrieve(self, request, pk=None):
        user = self.get_object()
        workouts = Workout.objects.filter(user=user).prefetch_related("exercises__sets", "exercises__exercise")[:30]
        weights = BodyWeight.objects.filter(user=user).defer("photo")[:60]
        return Response({**user_row(user), "workouts_list": WorkoutSerializer(workouts, many=True).data, "body_weights": BodyWeightSerializer(weights, many=True).data})

    def partial_update(self, request, pk=None):
        user = self.get_object()
        if "is_active" not in request.data:
            return Response({"detail": "Solo se puede cambiar is_active."}, status=status.HTTP_400_BAD_REQUEST)
        if user == request.user:
            return Response({"detail": "No podés bloquear tu propia cuenta."}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = bool(request.data["is_active"])
        user.save(update_fields=["is_active", "updated_at"])
        return self.retrieve(request, pk)
