import pytest
from django.core.management import call_command
from django.utils.text import slugify
from rest_framework.test import APIClient

from exercises.models import Exercise
from users.models import User
from workouts.management.commands.seed_demo import PLAN
from workouts.models import Workout


@pytest.mark.django_db
def test_seed_demo_creates_a_month_and_stays_hidden_from_real_users():
    for name in {row[0] for rows in PLAN.values() for row in rows}:
        Exercise.objects.create(name=name, slug=slugify(name))
    call_command("seed_demo", password="demo-pass-123")
    edu = User.objects.get(email="eduardo@demo.dynamo.app")
    assert edu.check_password("demo-pass-123")
    assert Workout.objects.filter(user=edu).count() >= 10

    demo = APIClient()
    demo.force_authenticate(user=edu)
    assert {p["name"] for p in demo.get("/api/profiles/").json()} == {"Jere Torres", "Gonzalo Saucedo", "Tomás Guzmán"}
    assert demo.get("/api/posts/").json()["results"]

    real = User.objects.create_user("real@example.com", name="Real")
    client = APIClient()
    client.force_authenticate(user=real)
    assert client.get("/api/profiles/?search=eduardo").json() == []
    assert client.get("/api/profiles/?tab=suggested").json() == []
    assert client.get("/api/posts/").json()["results"] == []
    assert client.get(f"/api/profiles/{edu.id}/").status_code == 404

    call_command("seed_demo", delete=True)
    assert not User.objects.filter(email__endswith="@demo.dynamo.app").exists()
