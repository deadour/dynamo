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
