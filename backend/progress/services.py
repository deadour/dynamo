from django.db.models import Sum, Max
from workouts.models import WorkoutSet
def epley(weight, reps): return weight * (1 + reps / 30) if weight > 0 and reps > 0 else 0
def exercise_stats(user, exercise_id):
    qs=WorkoutSet.objects.filter(workout_exercise__workout__user=user, workout_exercise__exercise_id=exercise_id, completed=True).select_related("workout_exercise__workout")
    sessions={}
    for s in qs:
        key=s.workout_exercise.workout.started_at.date(); row=sessions.setdefault(str(key),{"date":key,"best_weight":0,"best_1rm":0,"volume":0,"sets":0,"best_reps":0})
        row["best_weight"]=max(row["best_weight"],float(s.weight_kg)); row["best_1rm"]=max(row["best_1rm"],float(epley(float(s.weight_kg),s.reps))); row["volume"]+=float(s.weight_kg)*s.reps; row["sets"]+=1; row["best_reps"]=max(row["best_reps"],s.reps)
    return sorted(sessions.values(),key=lambda x:x["date"])
