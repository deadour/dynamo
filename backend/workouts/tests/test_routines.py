import pytest
from rest_framework.test import APIClient

from exercises.models import Exercise
from users.models import User
from workouts.models import Workout, WorkoutExercise


@pytest.fixture
def setup():
    user = User.objects.create_user("rutina@example.com")
    bench = Exercise.objects.create(name="Bench Press", name_es="Press de banca", slug="bench", image_1="https://img/bench.jpg")
    row = Exercise.objects.create(name="Barbell Row", slug="row")
    client = APIClient()
    client.force_authenticate(user=user)
    return user, client, bench, row


@pytest.mark.django_db
def test_create_update_and_list_routine_in_order(setup):
    user, client, bench, row = setup
    created = client.post("/api/routines/", {"name": "Pecho y espalda", "items": [{"exercise": str(bench.id), "target_sets": 4, "target_reps": "8-10"}, {"exercise": str(row.id)}]}, format="json")
    assert created.status_code == 201
    data = created.json()
    assert [i["exercise_name"] for i in data["items"]] == ["Press de banca", "Barbell Row"]
    assert data["items"][0]["image"] == "https://img/bench.jpg"

    updated = client.put(f"/api/routines/{data['id']}/", {"name": "Empuje", "items": [{"exercise": str(row.id)}]}, format="json").json()
    assert updated["name"] == "Empuje" and [i["exercise"] for i in updated["items"]] == [str(row.id)]
    assert client.get("/api/routines/").json()["count"] == 1


@pytest.mark.django_db
def test_routines_are_private_and_reject_other_users_custom_exercises(setup):
    user, client, bench, _ = setup
    other = User.objects.create_user("otro@example.com")
    private = Exercise.objects.create(name="Secreto", slug="secreto", is_custom=True, created_by=other)
    assert client.post("/api/routines/", {"name": "X", "items": [{"exercise": str(private.id)}]}, format="json").status_code == 400

    routine_id = client.post("/api/routines/", {"name": "Mía", "items": [{"exercise": str(bench.id)}]}, format="json").json()["id"]
    intruder = APIClient()
    intruder.force_authenticate(user=other)
    assert intruder.get(f"/api/routines/{routine_id}/").status_code == 404


@pytest.mark.django_db
def test_suggestions_include_recent_exercises_newest_first(setup):
    user, client, bench, row = setup
    WorkoutExercise.objects.create(workout=Workout.objects.create(user=user, started_at="2026-01-01T10:00:00Z"), exercise=bench)
    WorkoutExercise.objects.create(workout=Workout.objects.create(user=user, started_at="2026-01-05T10:00:00Z"), exercise=row)
    assert [e["name"] for e in client.get("/api/exercises/suggestions/").json()["recent"]] == ["Barbell Row", "Bench Press"]
