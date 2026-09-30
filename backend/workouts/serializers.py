from rest_framework import serializers
from django.db.models import Q
from exercises.models import Exercise
from .models import Routine, RoutineExercise, Workout, WorkoutExercise, WorkoutSet
class SetSerializer(serializers.ModelSerializer):
    volume=serializers.ReadOnlyField()
    class Meta: model=WorkoutSet; fields="__all__"
class WorkoutExerciseSerializer(serializers.ModelSerializer):
    sets=SetSerializer(many=True,read_only=True); exercise_name=serializers.SerializerMethodField()
    class Meta: model=WorkoutExercise; fields=["id","workout","exercise","exercise_name","order","notes","sets"]
    def get_exercise_name(self,obj): return obj.exercise.name_es or obj.exercise.name
class WorkoutSerializer(serializers.ModelSerializer):
    exercises=WorkoutExerciseSerializer(many=True,read_only=True); volume=serializers.SerializerMethodField(); exercise_count=serializers.SerializerMethodField()
    class Meta: model=Workout; fields=["id","name","started_at","finished_at","notes","created_at","updated_at","exercises","volume","exercise_count"]
    def get_volume(self,obj): return sum((s.volume for we in obj.exercises.all() for s in we.sets.all()), 0)
    def get_exercise_count(self,obj): return obj.exercises.count()



class RoutineItemSerializer(serializers.ModelSerializer):
    exercise_name = serializers.SerializerMethodField()
    image = serializers.CharField(source="exercise.image_1", read_only=True)
    primary_muscles = serializers.JSONField(source="exercise.primary_muscles", read_only=True)
    equipment = serializers.CharField(source="exercise.equipment", read_only=True)

    class Meta:
        model = RoutineExercise
        fields = ["id", "exercise", "exercise_name", "image", "primary_muscles", "equipment", "order", "target_sets", "target_reps"]
        read_only_fields = ["id", "order"]

    def get_exercise_name(self, obj):
        return obj.exercise.name_es or obj.exercise.name


class RoutineSerializer(serializers.ModelSerializer):
    """Una rutina con sus ejercicios. Al guardar, `items` reemplaza la lista completa (en ese orden)."""
    items = RoutineItemSerializer(many=True)

    class Meta:
        model = Routine
        fields = ["id", "name", "notes", "items", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_items(self, items):
        user = self.context["request"].user
        allowed = Exercise.objects.filter(active=True).filter(Q(is_custom=False) | Q(created_by=user))
        ids = [item["exercise"].id for item in items]
        if allowed.filter(id__in=ids).count() != len(set(ids)):
            raise serializers.ValidationError("Algún ejercicio no existe.")
        return items

    def _save_items(self, routine, items):
        routine.items.all().delete()
        RoutineExercise.objects.bulk_create([RoutineExercise(routine=routine, order=i, exercise=item["exercise"], target_sets=item.get("target_sets"), target_reps=item.get("target_reps", "")) for i, item in enumerate(items)])

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        routine = Routine.objects.create(**validated_data)
        self._save_items(routine, items)
        return routine

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items is not None:
            self._save_items(instance, items)
        return instance


class SharedRoutineSerializer(serializers.ModelSerializer):
    """Vista pública de una rutina: nunca expone email ni datos privados."""
    items = RoutineItemSerializer(many=True, read_only=True)
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Routine
        fields = ["id", "name", "notes", "items", "owner_name"]

    def get_owner_name(self, obj):
        return obj.user.name or "Usuario de Dynamo"
