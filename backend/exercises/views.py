from django.db.models import Count, Max, Q, Value
from django.db.models.functions import Coalesce, NullIf
import time

from django.http import HttpResponse
from django.urls import reverse
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Exercise
from bodymetrics.views import ImageParser, detect_image_type

from .serializers import CustomExerciseSerializer, ExerciseSerializer

MAX_EXERCISE_PHOTO_BYTES = 800_000
class ExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSerializer; permission_classes = [IsAuthenticated]; http_method_names = ["get", "post", "patch", "put", "delete"]
    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return Exercise.objects.none()
        q = Exercise.objects.filter(active=True).filter(is_custom=False) | Exercise.objects.filter(active=True, created_by=self.request.user)
        params = self.request.query_params
        if params.get("search"):
            term = params["search"].strip()
            q = q.filter(Q(name__icontains=term) | Q(name_es__icontains=term))
        if params.get("category"): q = q.filter(category__iexact=params["category"])
        if params.get("exclude_category"): q = q.exclude(category__in=[c.strip() for c in params["exclude_category"].split(",")])
        if params.get("equipment"): q = q.filter(equipment__iexact=params["equipment"])
        if params.get("difficulty"): q = q.filter(difficulty__iexact=params["difficulty"])
        if params.get("muscle"):
            # Acepta varios músculos separados por coma, ej: ?muscle=quadriceps,hamstrings
            muscles = Q()
            for muscle in [m.strip() for m in params["muscle"].split(",") if m.strip()]:
                muscles |= Q(primary_muscles__icontains=muscle)
            q = q.filter(muscles)
        return q.annotate(display_name=Coalesce(NullIf("name_es", Value("")), "name")).order_by("display_name").distinct()
    def get_serializer_class(self):
        return CustomExerciseSerializer if self.action in ("create", "update", "partial_update") else ExerciseSerializer

    def get_object(self):
        obj = super().get_object()
        # Solo el dueño puede modificar o borrar sus ejercicios propios; el catálogo es de solo lectura.
        if self.request.method not in ("GET", "HEAD", "OPTIONS") and not (obj.is_custom and obj.created_by_id == self.request.user.id):
            raise PermissionDenied("Solo podés modificar ejercicios que creaste vos.")
        return obj

    def perform_create(self, serializer): serializer.save(created_by=self.request.user, is_custom=True, source="custom")

    def perform_destroy(self, instance):
        from workouts.models import WorkoutExercise
        if WorkoutExercise.objects.filter(exercise=instance).exists():
            # Ya se usó en entrenamientos: se archiva para no perder el historial.
            instance.active = False
            instance.save(update_fields=["active", "updated_at"])
        else:
            instance.delete()

    @action(detail=True, methods=["put", "delete"], parser_classes=[ImageParser])
    def photo(self, request, pk=None):
        exercise = self.get_object()
        if request.method == "DELETE":
            exercise.photo, exercise.photo_type, exercise.image_1 = None, "", ""
            exercise.save(update_fields=["photo", "photo_type", "image_1", "updated_at"])
            return Response(ExerciseSerializer(exercise).data)
        data = request.data if isinstance(request.data, bytes) else b""
        content_type = detect_image_type(data)
        if content_type is None or len(data) > MAX_EXERCISE_PHOTO_BYTES:
            return Response({"detail": "Subí una imagen JPG, PNG o WebP de hasta 800 KB."}, status=status.HTTP_400_BAD_REQUEST)
        exercise.photo, exercise.photo_type = data, content_type
        exercise.image_1 = request.build_absolute_uri(reverse("exercise-photo", args=[exercise.id])) + f"?v={int(time.time())}"
        exercise.save(update_fields=["photo", "photo_type", "image_1", "updated_at"])
        return Response(ExerciseSerializer(exercise).data)

    @action(detail=False, methods=["get"])
    def suggestions(self, request):
        from workouts.models import WorkoutExercise
        done = WorkoutExercise.objects.filter(workout__user=request.user)
        frequent = list(done.values("exercise").annotate(times=Count("workout", distinct=True), last=Max("workout__started_at")).order_by("-times", "-last")[:8])
        # Últimos ejercicios distintos, del entrenamiento más reciente hacia atrás
        recent_ids = []
        for exercise_id in done.order_by("-workout__started_at", "-order").values_list("exercise", flat=True)[:200]:
            if exercise_id not in recent_ids:
                recent_ids.append(exercise_id)
            if len(recent_ids) == 8:
                break
        exercises = {str(e.id): e for e in Exercise.objects.filter(id__in=[row["exercise"] for row in frequent] + recent_ids)}
        # Última vez que se entrenó cada músculo principal
        last_by_muscle = {}
        for row in done.values("exercise__primary_muscles", "workout__started_at").order_by("-workout__started_at")[:300]:
            for muscle in row["exercise__primary_muscles"] or []:
                last_by_muscle.setdefault(muscle, row["workout__started_at"])
        return Response({
            "frequent": [{**ExerciseSerializer(exercises[str(row["exercise"])]).data, "times": row["times"], "last_done": row["last"]} for row in frequent if str(row["exercise"]) in exercises],
            "recent": [ExerciseSerializer(exercises[str(i)]).data for i in recent_ids if str(i) in exercises],
            "muscles_last_trained": last_by_muscle,
        })



@api_view(["GET"])
@permission_classes([AllowAny])
def exercise_photo(request, exercise_id):
    exercise = Exercise.objects.filter(pk=exercise_id, is_custom=True).only("photo", "photo_type").first()
    if exercise is None or not exercise.photo_type:
        return HttpResponse(status=404)
    response = HttpResponse(bytes(exercise.photo), content_type=exercise.photo_type)
    response["Cache-Control"] = "public, max-age=604800"
    return response
