import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from bodymetrics.models import BodyWeight
from users.models import User


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()


@pytest.mark.django_db
def test_register_then_login_with_email_and_password():
    client = APIClient()
    response = client.post("/api/auth/register/", {"email": "New@Example.com", "password": "gym-rat-2026", "name": "Edu"}, format="json")
    assert response.status_code == 201 and response.json()["email"] == "new@example.com"
    assert client.get("/api/auth/me/").json()["name"] == "Edu"

    other = APIClient()
    assert other.post("/api/auth/login/", {"email": "new@example.com", "password": "wrong-pass"}, format="json").status_code == 400
    assert other.post("/api/auth/login/", {"email": "new@example.com", "password": "gym-rat-2026"}, format="json").status_code == 200


@pytest.mark.django_db
def test_register_rejects_weak_password_and_duplicate_email():
    client = APIClient()
    assert client.post("/api/auth/register/", {"email": "a@example.com", "password": "123"}, format="json").status_code == 400
    User.objects.create_user("taken@example.com", password="whatever-123")
    assert client.post("/api/auth/register/", {"email": "TAKEN@example.com", "password": "gym-rat-2026"}, format="json").status_code == 400


@pytest.mark.django_db
def test_google_login_links_existing_email_account_and_revokes_its_password(monkeypatch):
    user = User.objects.create_user("victim@example.com", password="attacker-set-pass")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client")
    monkeypatch.setattr("users.views.id_token.verify_oauth2_token", lambda *a, **k: {"sub": "g-1", "email": "victim@example.com", "email_verified": True, "name": "Victim"})

    assert APIClient().post("/api/auth/google/", {"credential": "x"}, format="json").status_code == 200

    user.refresh_from_db()
    assert user.google_sub == "g-1" and not user.has_usable_password()
    assert User.objects.count() == 1


@pytest.mark.django_db
def test_admin_endpoints_are_staff_only_and_hide_photos():
    admin = User.objects.create_user("admin@example.com", is_staff=True)
    member = User.objects.create_user("member@example.com")
    BodyWeight.objects.create(user=member, date="2026-01-01", weight_kg=80, photo=b"\xff\xd8\xff", photo_type="image/jpeg")
    client = APIClient()

    client.force_authenticate(user=member)
    assert client.get("/api/admin/users/").status_code == 403

    client.force_authenticate(user=admin)
    assert {row["email"] for row in client.get("/api/admin/users/").json()["results"]} == {"admin@example.com", "member@example.com"}
    detail = client.get(f"/api/admin/users/{member.id}/").json()
    assert detail["body_weights"][0]["weight_kg"] == "80.00" and "photo" not in detail["body_weights"][0]
    assert client.patch(f"/api/admin/users/{member.id}/", {"is_active": False}, format="json").json()["is_active"] is False
    assert client.patch(f"/api/admin/users/{admin.id}/", {"is_active": False}, format="json").status_code == 400


@pytest.mark.django_db
def test_profile_avatar_upload_is_served_and_removable():
    user = User.objects.create_user("avatar@example.com")
    client = APIClient()
    client.force_authenticate(user=user)

    data = client.put("/api/auth/avatar/", b"\x89PNG\r\n\x1a\n" + b"0" * 50, content_type="image/png").json()
    assert f"/api/avatars/{user.id}/" in data["avatar_url"]
    assert APIClient().get(f"/api/avatars/{user.id}/")["Content-Type"] == "image/png"
    assert client.put("/api/auth/avatar/", b"not an image", content_type="image/png").status_code == 400
    assert client.delete("/api/auth/avatar/").json()["avatar_url"] == ""
    assert APIClient().get(f"/api/avatars/{user.id}/").status_code == 404


@pytest.mark.django_db
def test_email_and_password_change_require_current_password():
    user = User.objects.create_user("old@example.com", password="gym-rat-2026")
    User.objects.create_user("taken2@example.com")
    client = APIClient()
    client.force_authenticate(user=user)

    assert client.patch("/api/auth/me/", {"email": "new@example.com", "current_password": "nope"}, format="json").status_code == 400
    assert client.patch("/api/auth/me/", {"email": "taken2@example.com", "current_password": "gym-rat-2026"}, format="json").status_code == 400
    assert client.patch("/api/auth/me/", {"email": "New@example.com", "current_password": "gym-rat-2026", "name": "Edu"}, format="json").json()["email"] == "new@example.com"
    assert client.post("/api/auth/password/", {"current_password": "nope", "new_password": "otra-clave-2026"}, format="json").status_code == 400
    assert client.post("/api/auth/password/", {"current_password": "gym-rat-2026", "new_password": "otra-clave-2026"}, format="json").status_code == 200
    user.refresh_from_db()
    assert user.check_password("otra-clave-2026")


@pytest.mark.django_db
def test_admin_emails_promote_only_google_verified_logins(monkeypatch, settings):
    settings.ADMIN_EMAILS = {"boss@example.com"}
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client")
    APIClient().post("/api/auth/register/", {"email": "boss@example.com", "password": "gym-rat-2026"}, format="json")
    assert User.objects.get(email="boss@example.com").is_staff is False

    monkeypatch.setattr("users.views.id_token.verify_oauth2_token", lambda *a, **k: {"sub": "g-boss", "email": "boss@example.com", "email_verified": True})
    APIClient().post("/api/auth/google/", {"credential": "x"}, format="json")
    assert User.objects.get(email="boss@example.com").is_staff is True
