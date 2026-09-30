import uuid
from django.conf import settings
from django.db import models
from exercises.models import Exercise
class Workout(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name="workouts"); name=models.CharField(max_length=160,default="Entrenamiento"); started_at=models.DateTimeField(); finished_at=models.DateTimeField(null=True,blank=True); notes=models.TextField(blank=True); created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)
    class Meta: ordering=["-started_at"]; indexes=[models.Index(fields=["user","started_at"])]
class WorkoutExercise(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); workout=models.ForeignKey(Workout,on_delete=models.CASCADE,related_name="exercises"); exercise=models.ForeignKey(Exercise,on_delete=models.PROTECT); order=models.PositiveIntegerField(default=0); notes=models.TextField(blank=True); created_at=models.DateTimeField(auto_now_add=True)
class WorkoutSet(models.Model):
    TYPES=[("warmup","Calentamiento"),("normal","Normal"),("drop","Drop"),("failure","Fallo")]
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); workout_exercise=models.ForeignKey(WorkoutExercise,on_delete=models.CASCADE,related_name="sets"); set_number=models.PositiveIntegerField(); reps=models.PositiveIntegerField(); weight_kg=models.DecimalField(max_digits=7,decimal_places=2); set_type=models.CharField(max_length=10,choices=TYPES,default="normal"); completed=models.BooleanField(default=True); created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)
    @property
    def volume(self): return self.weight_kg * self.reps if self.completed else 0


class Routine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="routines")
    name = models.CharField(max_length=120)
    notes = models.TextField(blank=True)
    share_token = models.UUIDField(null=True, blank=True, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]


class RoutineExercise(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    routine = models.ForeignKey(Routine, on_delete=models.CASCADE, related_name="items")
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    target_sets = models.PositiveIntegerField(null=True, blank=True)
    target_reps = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["order"]
