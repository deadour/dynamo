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


@pytest.mark.django_db
def test_finish_can_move_the_workout_to_a_past_day_keeping_time_and_duration():
    user = User.objects.create_user("edu2@example.com", name="Edu")
    client = APIClient()
    client.force_authenticate(user=user)
    started = timezone.now() - timedelta(minutes=50)
    workout = Workout.objects.create(user=user, started_at=started)
    today = timezone.localdate()
    target = today - timedelta(days=3)

    assert client.post(f"/api/workouts/{workout.id}/finish/", {"date": str(today + timedelta(days=1))}, format="json").status_code == 400
    assert client.post(f"/api/workouts/{workout.id}/finish/", {"date": "no-es-fecha"}, format="json").status_code == 400
    data = client.post(f"/api/workouts/{workout.id}/finish/", {"date": str(target)}, format="json").json()
    workout.refresh_from_db()
    local = timezone.localtime(workout.started_at)
    assert local.date() == target and local.time().replace(microsecond=0) == timezone.localtime(started).time().replace(microsecond=0)
    assert 49 <= (workout.finished_at - workout.started_at).total_seconds() / 60 <= 51
    assert data["id"] == str(workout.id)

    # sin fecha: queda hoy, como siempre
    other = Workout.objects.create(user=user, started_at=timezone.now() - timedelta(minutes=5))
    client.post(f"/api/workouts/{other.id}/finish/", format="json")
    other.refresh_from_db()
    assert other.finished_at and timezone.localtime(other.started_at).date() == timezone.localtime(timezone.now() - timedelta(minutes=5)).date()
