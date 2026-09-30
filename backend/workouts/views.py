import uuid
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
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
        obj=self.get_object(); obj.finished_at=timezone.now(); obj.save(update_fields=["finished_at","updated_at"]); return Response(WorkoutSerializer(obj).data)
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


@api_view(["GET"])
@permission_classes([AllowAny])
def shared_routine(request, token):
    routine = get_object_or_404(
        Routine.objects.prefetch_related("items__exercise").select_related("user"),
        share_token=token,
    )
    return Response(SharedRoutineSerializer(routine).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_shared_routine(request, token):
    source = get_object_or_404(
        Routine.objects.prefetch_related("items__exercise"),
        share_token=token,
    )
    with transaction.atomic():
        routine = Routine.objects.create(
            user=request.user,
            name=f"Copia de {source.name}"[:120],
            notes=source.notes,
        )
        RoutineExercise.objects.bulk_create([
            RoutineExercise(
                routine=routine,
                exercise=item.exercise,
                order=item.order,
                target_sets=item.target_sets,
                target_reps=item.target_reps,
            )
            for item in source.items.all()
        ])
    routine = Routine.objects.prefetch_related("items__exercise").get(pk=routine.pk)
    return Response(RoutineSerializer(routine, context={"request": request}).data, status=status.HTTP_201_CREATED)
