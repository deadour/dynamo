import pytest
from rest_framework.test import APIClient

from users.models import User


@pytest.mark.django_db
def test_user_can_read_and_update_own_profile():
    user = User.objects.create_user("profile@example.com", name="Original")
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.patch("/api/auth/me/", {"name": "Nuevo nombre"}, format="json")

    assert response.status_code == 200
    assert response.json()["name"] == "Nuevo nombre"
    user.refresh_from_db()
    assert user.name == "Nuevo nombre"
    assert response.json()["email"] == "profile@example.com"
