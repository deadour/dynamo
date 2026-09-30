import pytest
from rest_framework.test import APIClient

from exercises.models import Exercise
from exercises.translations import spanish_exercise_name
from users.models import User
from workouts.models import Workout, WorkoutExercise


def test_translates_dataset_names_and_falls_back_to_original():
    assert spanish_exercise_name("One-Arm Dumbbell Row") == "Remo con mancuerna a un brazo"
    assert spanish_exercise_name("Wide-Grip Lat Pulldown") == "Jalón al pecho agarre ancho"
    assert spanish_exercise_name("Some Brand New Exercise") == "Some Brand New Exercise"


@pytest.mark.django_db
def test_filters_by_several_muscles_and_orders_by_spanish_name():
    user = User.objects.create_user("muscles@example.com")
    Exercise.objects.create(name="Leg Press", name_es="Prensa de piernas", slug="leg-press", primary_muscles=["quadriceps"])
    Exercise.objects.create(name="Lying Leg Curls", name_es="Camilla de isquiotibiales", slug="leg-curl", primary_muscles=["hamstrings"])
    Exercise.objects.create(name="Bench Press", name_es="Press de banca", slug="bench", primary_muscles=["chest"])
    client = APIClient()
    client.force_authenticate(user=user)

    names = [row["name_es"] for row in client.get("/api/exercises/?muscle=quadriceps,hamstrings").json()["results"]]

    assert names == ["Camilla de isquiotibiales", "Prensa de piernas"]


@pytest.mark.django_db
def test_suggestions_return_frequent_exercises_and_last_trained_muscles():
    user = User.objects.create_user("suggest@example.com")
    other = User.objects.create_user("other@example.com")
    bench = Exercise.objects.create(name="Bench Press", slug="bench", primary_muscles=["chest"])
    row = Exercise.objects.create(name="Barbell Row", slug="row", primary_muscles=["middle back"])
    for day in ("2026-01-01", "2026-01-03"):
        workout = Workout.objects.create(user=user, started_at=f"{day}T10:00:00Z")
        WorkoutExercise.objects.create(workout=workout, exercise=bench)
    WorkoutExercise.objects.create(workout=Workout.objects.create(user=user, started_at="2026-01-02T10:00:00Z"), exercise=row)
    WorkoutExercise.objects.create(workout=Workout.objects.create(user=other, started_at="2026-01-05T10:00:00Z"), exercise=row)
    client = APIClient()
    client.force_authenticate(user=user)

    data = client.get("/api/exercises/suggestions/").json()

    assert [(item["name"], item["times"]) for item in data["frequent"]] == [("Bench Press", 2), ("Barbell Row", 1)]
    assert data["muscles_last_trained"]["chest"].startswith("2026-01-03")
    assert data["muscles_last_trained"]["middle back"].startswith("2026-01-02")


@pytest.mark.django_db
def test_import_stores_spanish_names_instructions_and_details(tmp_path):
    import json
    from django.core.management import call_command
    dataset = [{"id": "Barbell_Curl", "name": "Barbell Curl", "force": "pull", "mechanic": "isolation", "level": "beginner", "equipment": "barbell", "category": "strength", "primaryMuscles": ["biceps"], "secondaryMuscles": ["forearms"], "instructions": ["Stand up."], "images": ["Barbell_Curl/0.jpg", "Barbell_Curl/1.jpg"]}]
    source = tmp_path / "exercises.json"
    source.write_text(json.dumps(dataset), encoding="utf-8")

    call_command("import_exercises", file=str(source))

    exercise = Exercise.objects.get(external_id="Barbell_Curl")
    assert exercise.name_es == "Curl de bíceps con barra"
    assert (exercise.force, exercise.mechanic) == ("pull", "isolation")
    assert exercise.instructions_es[0].startswith("Parate derecho")
    assert exercise.image_2.endswith("Barbell_Curl/1.jpg")


@pytest.mark.django_db
def test_user_can_create_a_private_custom_exercise():
    user = User.objects.create_user("custom@example.com")
    other = User.objects.create_user("other-custom@example.com")
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post("/api/exercises/", {"name": "Press unilateral", "name_es": "Press unilateral", "primary_muscles": ["chest"], "equipment": "cable", "instructions_es": ["Empujá de forma controlada."]}, format="json")
    assert response.status_code == 201
    exercise = Exercise.objects.get(name="Press unilateral")
    assert exercise.is_custom is True and exercise.created_by_id == user.id
    other_client = APIClient()
    other_client.force_authenticate(user=other)
    assert other_client.get(f"/api/exercises/{exercise.id}/").status_code == 404


@pytest.mark.django_db
def test_user_creates_edits_and_deletes_private_custom_exercise():
    owner = User.objects.create_user("custom@example.com")
    other = User.objects.create_user("other-custom@example.com")
    client = APIClient()
    client.force_authenticate(user=owner)

    created = client.post("/api/exercises/", {"name": "  Remo  en  máquina Hammer ", "primary_muscles": ["lats"], "equipment": "machine", "category": "strength", "instructions_es": ["Sentate.", " "]}, format="json")
    assert created.status_code == 201
    data = created.json()
    assert (data["name"], data["name_es"], data["is_custom"]) == ("Remo en máquina Hammer", "Remo en máquina Hammer", True)
    assert data["instructions_es"] == ["Sentate."] and "photo" not in data

    assert client.post("/api/exercises/", {"name": "X", "primary_muscles": ["lats"]}, format="json").status_code == 400
    assert client.post("/api/exercises/", {"name": "Sin músculo", "primary_muscles": []}, format="json").status_code == 400
    assert client.post("/api/exercises/", {"name": "Raro", "primary_muscles": ["alas"]}, format="json").status_code == 400
    assert client.patch(f"/api/exercises/{data['id']}/", {"name": "Remo Hammer"}, format="json").json()["name_es"] == "Remo Hammer"

    intruder = APIClient()
    intruder.force_authenticate(user=other)
    assert intruder.get(f"/api/exercises/{data['id']}/").status_code == 404
    assert client.delete(f"/api/exercises/{data['id']}/").status_code == 204
    assert not Exercise.objects.filter(id=data["id"]).exists()


@pytest.mark.django_db
def test_catalog_is_read_only_and_used_custom_exercises_are_archived():
    user = User.objects.create_user("archive@example.com")
    catalog = Exercise.objects.create(name="Bench", slug="bench")
    client = APIClient()
    client.force_authenticate(user=user)
    assert client.patch(f"/api/exercises/{catalog.id}/", {"name": "Hack"}, format="json").status_code == 403
    assert client.delete(f"/api/exercises/{catalog.id}/").status_code == 403

    mine = client.post("/api/exercises/", {"name": "Mío", "primary_muscles": ["chest"]}, format="json").json()
    WorkoutExercise.objects.create(workout=Workout.objects.create(user=user, started_at="2026-01-01T10:00:00Z"), exercise_id=mine["id"])
    assert client.delete(f"/api/exercises/{mine['id']}/").status_code == 204
    assert Exercise.objects.get(id=mine["id"]).active is False


@pytest.mark.django_db
def test_custom_exercise_photo_upload_and_public_serving():
    user = User.objects.create_user("photo-ex@example.com")
    client = APIClient()
    client.force_authenticate(user=user)
    mine = client.post("/api/exercises/", {"name": "Con foto", "primary_muscles": ["chest"]}, format="json").json()
    data = client.put(f"/api/exercises/{mine['id']}/photo/", b"\xff\xd8\xff" + b"0" * 40, content_type="image/jpeg").json()
    assert f"/api/exercise-photos/{mine['id']}/" in data["image_1"]
    assert APIClient().get(f"/api/exercise-photos/{mine['id']}/")["Content-Type"] == "image/jpeg"
    assert client.put(f"/api/exercises/{mine['id']}/photo/", b"nope", content_type="image/jpeg").status_code == 400


@pytest.mark.django_db
def test_mine_lists_logged_exercises_most_frequent_first():
    user = User.objects.create_user("mine@example.com")
    other = User.objects.create_user("mine-other@example.com")
    bench = Exercise.objects.create(name="Bench", slug="bench")
    squat = Exercise.objects.create(name="Squat", slug="squat")
    Exercise.objects.create(name="Never done", slug="never")
    for day, exercise in [("01", bench), ("02", squat), ("03", squat)]:
        WorkoutExercise.objects.create(workout=Workout.objects.create(user=user, started_at=f"2026-01-{day}T10:00:00Z"), exercise=exercise)
    WorkoutExercise.objects.create(workout=Workout.objects.create(user=other, started_at="2026-01-04T10:00:00Z"), exercise=bench)
    client = APIClient()
    client.force_authenticate(user=user)
    rows = client.get("/api/exercises/?mine=1").json()["results"]
    assert [(r["name"], r["times"]) for r in rows] == [("Squat", 2), ("Bench", 1)]
    assert client.get("/api/exercises/?mine=1&search=ben").json()["results"][0]["name"] == "Bench"
