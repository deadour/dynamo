from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from exercises.models import Exercise
from users.models import User
from workouts.models import Workout, WorkoutExercise, WorkoutSet


def log(user, exercise, days_ago, sets):
    workout = Workout.objects.create(user=user, started_at=timezone.now() - timedelta(days=days_ago))
    row = WorkoutExercise.objects.create(workout=workout, exercise=exercise)
    for n, (weight, reps) in enumerate(sets, 1):
        WorkoutSet.objects.create(workout_exercise=row, set_number=n, weight_kg=weight, reps=reps)
    return workout


@pytest.mark.django_db
def test_last_session_skips_current_workout_and_other_users():
    edu = User.objects.create_user("edu@example.com")
    other = User.objects.create_user("otro@example.com")
    squat = Exercise.objects.create(name="Squat", slug="squat")
    log(edu, squat, 9, [(100, 8)])
    log(edu, squat, 3, [(110, 8), (110, 7)])
    today = log(edu, squat, 0, [(115, 5)])
    log(other, squat, 1, [(200, 1)])
    client = APIClient()
    client.force_authenticate(user=edu)
    last = client.get(f"/api/progress/exercises/{squat.id}/last/?exclude={today.id}").json()
    assert last["sets"] == [{"weight_kg": 110.0, "reps": 8}, {"weight_kg": 110.0, "reps": 7}]
    bench = Exercise.objects.create(name="Bench", slug="bench")
    assert client.get(f"/api/progress/exercises/{bench.id}/last/").json()["sets"] == []
