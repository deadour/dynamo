from datetime import timedelta
from django.utils import timezone
from django.db.models import Q
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from workouts.models import Workout
from exercises.models import Exercise
from bodymetrics.models import BodyWeight
from .services import exercise_stats
@api_view(["GET"])
def exercise_progress(request,exercise_id):
    exercise=Exercise.objects.filter(id=exercise_id, active=True).filter(
        Q(is_custom=False) | Q(created_by=request.user)
    ).first()
    if exercise is None:
        raise NotFound("Ejercicio no encontrado.")
    rows=exercise_stats(request.user,exercise_id); return Response({"exercise":{"id":str(exercise.id),"name":exercise.name,"image_1":exercise.image_1},"sessions":rows,"summary":{"sessions":len(rows),"best_weight":max((r["best_weight"] for r in rows),default=0),"best_1rm":max((r["best_1rm"] for r in rows),default=0),"volume":sum(r["volume"] for r in rows)}})
@api_view(["GET"])
def dashboard(request):
    since=timezone.now()-timedelta(days=30); workouts=list(Workout.objects.filter(user=request.user,started_at__gte=since).prefetch_related("exercises__sets")); volume=sum(float(s.weight_kg)*s.reps for w in workouts for e in w.exercises.all() for s in e.sets.all() if s.completed); weights=BodyWeight.objects.filter(user=request.user).order_by("-date"); return Response({"weight_current":float(weights.first().weight_kg) if weights.exists() else None,"workouts_30d":len(workouts),"volume_30d":volume,"recent_workouts":[{"id":str(w.id),"name":w.name,"date":w.started_at.date(),"volume":sum(float(s.weight_kg)*s.reps for e in w.exercises.all() for s in e.sets.all() if s.completed)} for w in workouts[:5]]})
