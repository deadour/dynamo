from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Workout, WorkoutExercise, WorkoutSet
from .serializers import WorkoutSerializer, WorkoutExerciseSerializer, SetSerializer
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
