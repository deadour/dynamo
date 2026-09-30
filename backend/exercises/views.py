from django.db.models import Count, Max, Q, Value
from django.db.models.functions import Coalesce, NullIf
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Exercise
from .serializers import ExerciseSerializer
class ExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSerializer; permission_classes = [IsAuthenticated]; http_method_names = ["get", "post"]
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
    def perform_create(self, serializer): serializer.save(created_by=self.request.user, is_custom=True, source="custom")

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
