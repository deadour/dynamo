from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from exercises.models import Exercise
from users.models import User
from workouts.models import Workout, WorkoutExercise, WorkoutSet


@pytest.mark.django_db
def test_calendar_lists_last_year_workouts_with_completed_sets():
    user = User.objects.create_user("edu@example.com", name="Edu")
    other = User.objects.create_user("otro@example.com", name="Otro")
    squat = Exercise.objects.create(name="Squat", slug="squat")
    now = timezone.now()
    recent = Workout.objects.create(user=user, started_at=now - timedelta(days=2))
    row = WorkoutExercise.objects.create(workout=recent, exercise=squat)
    for n, done in ((1, True), (2, True), (3, False)):
        WorkoutSet.objects.create(workout_exercise=row, set_number=n, reps=10, weight_kg=50, completed=done)
    Workout.objects.create(user=user, started_at=now - timedelta(days=400))  # más de un año: no entra
    Workout.objects.create(user=other, started_at=now)  # de otra persona: no entra

    client = APIClient()
    client.force_authenticate(user=user)
    days = client.get("/api/workouts/calendar/").json()
    assert [d["sets"] for d in days] == [2]
