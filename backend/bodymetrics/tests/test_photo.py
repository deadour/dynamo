import pytest
from rest_framework.test import APIClient

from bodymetrics.models import BodyWeight
from users.models import User

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


@pytest.mark.django_db
def test_user_can_upload_view_and_delete_progress_photo():
    user = User.objects.create_user("photo@example.com")
    entry = BodyWeight.objects.create(user=user, date="2026-01-01", weight_kg=80)
    client = APIClient()
    client.force_authenticate(user=user)
    url = f"/api/body-weight/{entry.id}/photo/"

    assert client.put(url, JPEG, content_type="image/jpeg").json()["has_photo"] is True
    response = client.get(url)
    assert response["Content-Type"] == "image/jpeg" and response.content == JPEG
    assert client.get("/api/body-weight/").json()["results"][0]["has_photo"] is True
    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404


@pytest.mark.django_db
def test_rejects_non_images_and_other_users_photos():
    owner = User.objects.create_user("owner@example.com")
    intruder = User.objects.create_user("intruder@example.com")
    entry = BodyWeight.objects.create(user=owner, date="2026-01-01", weight_kg=80, photo=JPEG, photo_type="image/jpeg")
    client = APIClient()
    client.force_authenticate(user=owner)
    assert client.put(f"/api/body-weight/{entry.id}/photo/", b"<script>", content_type="image/jpeg").status_code == 400

    client.force_authenticate(user=intruder)
    assert client.get(f"/api/body-weight/{entry.id}/photo/").status_code == 404
    assert client.delete(f"/api/body-weight/{entry.id}/photo/").status_code == 404
