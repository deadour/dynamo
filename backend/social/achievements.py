from datetime import timedelta

from django.db.models import F, Sum
from django.utils import timezone

from workouts.models import Workout, WorkoutSet
from .models import Achievement, UserAchievement


DEFINITIONS = [
    {"code": "first_workout", "title": "Primer paso", "description": "Completaste tu primer entrenamiento.", "icon": "🚀", "metric": "workouts", "target": 1},
    {"code": "workouts_3", "title": "En movimiento", "description": "Completaste 3 entrenamientos.", "icon": "💪", "metric": "workouts", "target": 3},
    {"code": "workouts_5", "title": "Buen ritmo", "description": "Completaste 5 entrenamientos.", "icon": "🎯", "metric": "workouts", "target": 5},
    {"code": "workouts_10", "title": "Constancia", "description": "Completaste 10 entrenamientos.", "icon": "🔥", "metric": "workouts", "target": 10},
    {"code": "workouts_25", "title": "Disciplina", "description": "Completaste 25 entrenamientos.", "icon": "🏆", "metric": "workouts", "target": 25},
    {"code": "workouts_50", "title": "Imparable", "description": "Completaste 50 entrenamientos.", "icon": "👑", "metric": "workouts", "target": 50},
    {"code": "streak_3", "title": "Racha inicial", "description": "Entrenaste 3 días seguidos.", "icon": "⚡", "metric": "streak_days", "target": 3},
    {"code": "streak_7", "title": "Una semana fuerte", "description": "Entrenaste 7 días seguidos.", "icon": "🏅", "metric": "streak_days", "target": 7},
    {"code": "streak_14", "title": "Dos semanas firmes", "description": "Entrenaste 14 días seguidos.", "icon": "🌟", "metric": "streak_days", "target": 14},
    {"code": "streak_30", "title": "Mes de acero", "description": "Entrenaste 30 días seguidos.", "icon": "🛡️", "metric": "streak_days", "target": 30},
    {"code": "weeks_2", "title": "Dos semanas activas", "description": "Mantuviste actividad durante 2 semanas seguidas.", "icon": "📅", "metric": "active_weeks", "target": 2},
    {"code": "weeks_4", "title": "Un mes activo", "description": "Mantuviste actividad durante 4 semanas seguidas.", "icon": "🗓️", "metric": "active_weeks", "target": 4},
    {"code": "weeks_8", "title": "Hábito construido", "description": "Mantuviste actividad durante 8 semanas seguidas.", "icon": "🌱", "metric": "active_weeks", "target": 8},
    {"code": "weeks_12", "title": "Parte de tu rutina", "description": "Mantuviste actividad durante 12 semanas seguidas.", "icon": "🧭", "metric": "active_weeks", "target": 12},
    {"code": "volume_1000", "title": "Primer tonelaje", "description": "Moviste 1.000 kg de volumen acumulado.", "icon": "🏋️", "metric": "volume", "target": 1000},
    {"code": "volume_5000", "title": "Cinco toneladas", "description": "Moviste 5.000 kg de volumen acumulado.", "icon": "🔩", "metric": "volume", "target": 5000},
    {"code": "volume_10000", "title": "Diez toneladas", "description": "Moviste 10.000 kg de volumen acumulado.", "icon": "💥", "metric": "volume", "target": 10000},
    {"code": "volume_25000", "title": "Fuerza acumulada", "description": "Moviste 25.000 kg de volumen acumulado.", "icon": "🦾", "metric": "volume", "target": 25000},
    {"code": "exercises_5", "title": "Explorador", "description": "Probaste 5 ejercicios distintos.", "icon": "🧪", "metric": "exercise_count", "target": 5},
    {"code": "exercises_25", "title": "Caja de herramientas", "description": "Probaste 25 ejercicios distintos.", "icon": "🧰", "metric": "exercise_count", "target": 25},
]


def ensure_definitions():
    for values in DEFINITIONS:
        Achievement.objects.update_or_create(code=values["code"], defaults=values)


def _longest_run(values):
    if not values:
        return 0
    ordered = sorted(values)
    longest = current = 1
    for previous, current_value in zip(ordered, ordered[1:]):
        if current_value == previous + timedelta(days=1):
            current += 1
        else:
            current = 1
        longest = max(longest, current)
    return longest


def _longest_week_run(values):
    if not values:
        return 0
    ordered = sorted(values)
    longest = current = 1
    for previous, current_value in zip(ordered, ordered[1:]):
        if current_value == previous + 1:
            current += 1
        else:
            current = 1
        longest = max(longest, current)
    return longest


def sync_user_achievements(user):
    """Unlock achievements idempotently after a workout is completed."""
    ensure_definitions()
    workouts = Workout.objects.filter(user=user, finished_at__isnull=False)
    dates = set(workouts.values_list("started_at__date", flat=True))
    weeks = {(day.isocalendar().year, day.isocalendar().week) for day in dates}
    volume = WorkoutSet.objects.filter(
        workout_exercise__workout__in=workouts, completed=True
    ).aggregate(total=Sum(F("weight_kg") * F("reps")))
    total_volume = int(volume["total"] or 0)
    exercise_count = workouts.filter(exercises__isnull=False).values("exercises__exercise_id").distinct().count()
    values = {
        "workouts": workouts.count(),
        "streak_days": _longest_run(dates),
        "active_weeks": _longest_week_run({(year * 53) + week for year, week in weeks}),
        "volume": total_volume,
        "exercise_count": exercise_count,
    }
    unlocked = []
    for achievement in Achievement.objects.all():
        if values.get(achievement.metric, 0) >= achievement.target:
            row, created = UserAchievement.objects.get_or_create(user=user, achievement=achievement)
            if created:
                unlocked.append(row)
    return unlocked
