import pytest
from rest_framework.test import APIClient

from exercises.models import Exercise
from users.models import User


@pytest.mark.django_db
def test_private_endpoints_require_authentication():
    client = APIClient()
    assert client.get("/api/auth/me/").status_code in (401, 403)
    assert client.get("/api/exercises/").status_code in (401, 403)
    assert client.get("/api/dashboard/summary/").status_code in (401, 403)


@pytest.mark.django_db
def test_authenticated_user_can_filter_exercises():
    user = User.objects.create_user("filter@example.com")
    Exercise.objects.create(name="Bench press", slug="bench-press", equipment="barbell")
    Exercise.objects.create(name="Goblet squat", slug="goblet-squat", equipment="dumbbell")
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get("/api/exercises/?equipment=barbell")
    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["name"] == "Bench press"
