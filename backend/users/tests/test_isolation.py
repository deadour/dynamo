import pytest
from rest_framework.test import APIClient

from bodymetrics.models import BodyWeight
from exercises.models import Exercise
from users.models import User
from workouts.models import Workout


@pytest.mark.django_db
def test_users_cannot_read_or_modify_each_others_private_data():
    user_a = User.objects.create_user("a@example.com")
    user_b = User.objects.create_user("b@example.com")
    exercise = Exercise.objects.create(name="Press", slug="press")
    workout = Workout.objects.create(user=user_b, name="B workout", started_at="2026-01-01T10:00:00Z")
    body_weight = BodyWeight.objects.create(user=user_b, date="2026-01-01", weight_kg=80)
    client = APIClient()
    client.force_authenticate(user=user_a)

    assert client.get(f"/api/workouts/{workout.id}/").status_code == 404
    assert client.patch(f"/api/workouts/{workout.id}/", {"name": "hacked"}, format="json").status_code == 404
    assert client.get(f"/api/body-weight/{body_weight.id}/").status_code == 404
    assert client.patch(f"/api/body-weight/{body_weight.id}/", {"weight_kg": 1}, format="json").status_code == 404
    assert client.get("/api/workouts/").json()["count"] == 0
    assert client.get("/api/body-weight/").json()["count"] == 0
    assert exercise.id


@pytest.mark.django_db
def test_user_cannot_attach_or_view_another_users_custom_exercise():
    user_a = User.objects.create_user("a2@example.com")
    user_b = User.objects.create_user("b2@example.com")
    private_exercise = Exercise.objects.create(
        name="Private press", slug="private-press", is_custom=True, created_by=user_b
    )
    workout = Workout.objects.create(user=user_a, name="A workout", started_at="2026-01-01T10:00:00Z")
    client = APIClient()
    client.force_authenticate(user=user_a)

    assert client.get(f"/api/exercises/{private_exercise.id}/").status_code == 404
    assert client.post(
        f"/api/workouts/{workout.id}/exercises/", {"exercise": str(private_exercise.id)}, format="json"
    ).status_code == 404
    assert client.get(f"/api/progress/exercises/{private_exercise.id}/").status_code == 404
