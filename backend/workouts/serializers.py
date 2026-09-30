from rest_framework import serializers
from .models import Workout, WorkoutExercise, WorkoutSet
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
