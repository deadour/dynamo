import uuid
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from exercises.models import Exercise
from .models import Routine, RoutineExercise, Workout, WorkoutExercise, WorkoutSet
from .serializers import RoutineSerializer, SharedRoutineSerializer, WorkoutSerializer, WorkoutExerciseSerializer, SetSerializer
class WorkoutViewSet(viewsets.ModelViewSet):
    serializer_class=WorkoutSerializer
    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return Workout.objects.none()
        return Workout.objects.filter(user=self.request.user).prefetch_related("exercises__sets","exercises__exercise")
    def perform_create(self,serializer): serializer.save(user=self.request.user,started_at=serializer.validated_data.get("started_at",timezone.now()))
    @action(detail=True,methods=["post"],url_path="exercises")
    def add_exercise(self,request,pk=None):
        workout=self.get_object()
        from exercises.models import Exercise
        exercise = Exercise.objects.filter(active=True).filter(
            Q(is_custom=False) | Q(created_by=request.user), id=request.data.get("exercise")
        ).first()
        if exercise is None:
            return Response({"detail": "Ejercicio no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        obj=WorkoutExercise.objects.create(workout=workout,exercise=exercise,order=workout.exercises.count())
        return Response(WorkoutExerciseSerializer(obj).data,status=201)
    @action(detail=True,methods=["post"],url_path="finish")
    def finish(self,request,pk=None):
        obj=self.get_object(); obj.finished_at=timezone.now(); obj.save(update_fields=["finished_at","updated_at"])
        from social.achievements import sync_user_achievements
        unlocked = sync_user_achievements(request.user)
        from social.notifications import notify_achievements
        notify_achievements(request.user, unlocked)
        data = WorkoutSerializer(obj).data
        data["unlocked_achievements"] = [{"title": row.achievement.title, "icon": row.achievement.icon} for row in unlocked]
        return Response(data)
class WorkoutExerciseViewSet(viewsets.ModelViewSet):
    serializer_class=WorkoutExerciseSerializer
    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return WorkoutExercise.objects.none()
        return WorkoutExercise.objects.filter(workout__user=self.request.user).prefetch_related("sets")
    @action(detail=True,methods=["post"],url_path="sets")
    def add_set(self,request,pk=None):
        obj=self.get_object(); data={**request.data,"workout_exercise":obj.id}; ser=SetSerializer(data=data); ser.is_valid(raise_exception=True); ser.save(); return Response(ser.data,status=201)


class WorkoutSetViewSet(viewsets.ModelViewSet):
    serializer_class = SetSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return WorkoutSet.objects.none()
        return WorkoutSet.objects.filter(workout_exercise__workout__user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(workout_exercise=self.get_object().workout_exercise)



class RoutineViewSet(viewsets.ModelViewSet):
    serializer_class = RoutineSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return Routine.objects.none()
        return Routine.objects.filter(user=self.request.user).prefetch_related("items__exercise")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, pk=None):
        routine = self.get_object()
        if routine.share_token is None:
            routine.share_token = uuid.uuid4()
            routine.save(update_fields=["share_token"])
        return Response({"token": str(routine.share_token)})

    # Agregar / sacar un ejercicio suelto (como sumar una canción a una playlist) sin reemplazar la lista.
    @action(detail=True, methods=["post"], url_path="items")
    def add_item(self, request, pk=None):
        routine = self.get_object()
        exercise = Exercise.objects.filter(active=True).filter(Q(is_custom=False) | Q(created_by=request.user), id=request.data.get("exercise")).first()
        if exercise is None:
            return Response({"detail": "Ejercicio no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        if not routine.items.filter(exercise=exercise).exists():
            last = routine.items.order_by("-order").values_list("order", flat=True).first()
            RoutineExercise.objects.create(routine=routine, exercise=exercise, order=(last or 0) + 1, target_sets=3, target_reps="10")
        return Response(RoutineSerializer(self.get_queryset().get(pk=routine.pk), context={"request": request}).data)

    @action(detail=True, methods=["delete"], url_path=r"items/(?P<exercise_id>[^/.]+)")
    def remove_item(self, request, pk=None, exercise_id=None):
        routine = self.get_object()
        routine.items.filter(exercise_id=exercise_id).delete()
        return Response(RoutineSerializer(self.get_queryset().get(pk=routine.pk), context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def shared_routine(request, token):
    routine = get_object_or_404(
        Routine.objects.prefetch_related("items__exercise").select_related("user"),
        share_token=token,
    )
    return Response(SharedRoutineSerializer(routine).data)


def _usable_exercise(exercise, user):
    """Los ejercicios propios son privados: si la rutina trae uno ajeno, se copia para quien importa."""
    if not exercise.is_custom or exercise.created_by_id == user.id:
        return exercise
    copy = Exercise.objects.filter(is_custom=True, created_by=user, name=exercise.name).first()
    if copy is None:
        copy = Exercise.objects.create(
            name=exercise.name, name_es=exercise.name_es, slug=exercise.slug, category=exercise.category,
            primary_muscles=exercise.primary_muscles, secondary_muscles=exercise.secondary_muscles,
            equipment=exercise.equipment, difficulty=exercise.difficulty, instructions_es=exercise.instructions_es,
            image_1=exercise.image_1, is_custom=True, created_by=user, source="custom",
        )
    return copy


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_shared_routine(request, token):
    source = get_object_or_404(
        Routine.objects.prefetch_related("items__exercise"),
        share_token=token,
    )
    routine = copy_routine(source, request.user, f"Copia de {source.name}")
    return Response(RoutineSerializer(routine, context={"request": request}).data, status=status.HTTP_201_CREATED)


def copy_routine(source, user, name):
    """Copia una rutina ajena a la cuenta de `user` (los ejercicios propios privados también se copian)."""
    with transaction.atomic():
        routine = Routine.objects.create(user=user, name=name[:120], notes=source.notes, source=source)
        RoutineExercise.objects.bulk_create([
            RoutineExercise(routine=routine, exercise=_usable_exercise(item.exercise, user), order=item.order,
                            target_sets=item.target_sets, target_reps=item.target_reps)
            for item in source.items.all()
        ])
    return Routine.objects.prefetch_related("items__exercise").get(pk=routine.pk)
