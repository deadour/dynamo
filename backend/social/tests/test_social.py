import pytest
from rest_framework.test import APIClient

from exercises.models import Exercise
from social.models import Follow
from users.models import User
from workouts.models import Workout, WorkoutExercise


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def people():
    return {name: User.objects.create_user(f"{name}@example.com", name=name.title()) for name in ("edu", "tobi", "tomi", "extraño")}


def befriend(a, b):
    Follow.objects.create(follower=a, following=b)
    Follow.objects.create(follower=b, following=a)


@pytest.mark.django_db
def test_visibility_public_vs_friends_only(people):
    edu, tobi, tomi = people["edu"], people["tobi"], people["tomi"]
    befriend(edu, tobi)
    Follow.objects.create(follower=tomi, following=edu)  # tomi sigue a edu, pero edu no lo sigue: no son amigos
    edu_client = client_for(edu)
    public = edu_client.post("/api/posts/", {"text": "Público", "visibility": "public"}, format="json").json()
    friends = edu_client.post("/api/posts/", {"text": "Solo amigos", "visibility": "friends"}, format="json").json()

    tobi_feed = [p["text"] for p in client_for(tobi).get("/api/posts/").json()["results"]]
    tomi_feed = [p["text"] for p in client_for(tomi).get("/api/posts/").json()["results"]]
    assert tobi_feed == ["Solo amigos", "Público"]
    assert tomi_feed == ["Público"]
    # un desconocido ve lo público en el perfil, pero no puede abrir lo de amigos
    stranger = client_for(people["extraño"])
    assert [p["text"] for p in stranger.get(f"/api/posts/?user={edu.id}").json()["results"]] == ["Público"]
    assert stranger.get(f"/api/posts/{friends['id']}/").status_code == 404
    assert stranger.post(f"/api/posts/{friends['id']}/like/").status_code == 404
    assert stranger.post(f"/api/posts/{public['id']}/like/").json()["liked"] is True


@pytest.mark.django_db
def test_like_comment_and_only_owner_edits(people):
    edu, tobi = people["edu"], people["tobi"]
    befriend(edu, tobi)
    post = client_for(edu).post("/api/posts/", {"text": "Hoy piernas"}, format="json").json()
    tobi_client = client_for(tobi)
    assert tobi_client.post(f"/api/posts/{post['id']}/like/").json() == {"liked": True, "like_count": 1}
    assert tobi_client.post(f"/api/posts/{post['id']}/comments/", {"text": "Vamos!"}, format="json").status_code == 201
    listed = client_for(edu).get("/api/posts/").json()["results"][0]
    assert (listed["like_count"], listed["comment_count"], listed["liked"], listed["is_mine"]) == (1, 1, False, True)
    assert tobi_client.patch(f"/api/posts/{post['id']}/", {"text": "hack"}, format="json").status_code == 403
    assert tobi_client.delete(f"/api/posts/{post['id']}/").status_code == 403
    assert client_for(edu).post("/api/posts/", {"text": "   "}, format="json").status_code == 400


@pytest.mark.django_db
def test_cannot_share_someone_elses_workout(people):
    edu, tobi = people["edu"], people["tobi"]
    tobis_workout = Workout.objects.create(user=tobi, name="Privado", started_at="2026-09-30T10:00:00Z")
    response = client_for(edu).post("/api/posts/", {"workout": str(tobis_workout.id)}, format="json")
    assert response.status_code == 400
    mine = Workout.objects.create(user=edu, name="Pecho", started_at="2026-09-30T10:00:00Z")
    shared = client_for(edu).post("/api/posts/", {"workout": str(mine.id)}, format="json").json()
    assert shared["post_type"] == "workout" and shared["workout_summary"]["name"] == "Pecho"


@pytest.mark.django_db
def test_friendship_is_mutual_follow_and_profile_details_only_for_friends(people):
    edu, tobi = people["edu"], people["tobi"]
    Workout.objects.create(user=tobi, name="Espalda", started_at="2026-09-30T10:00:00Z")
    edu_client = client_for(edu)
    assert edu_client.post(f"/api/profiles/{tobi.id}/follow/").json()["is_friend"] is False
    profile = edu_client.get(f"/api/profiles/{tobi.id}/").json()
    assert profile["stats"]["workouts_total"] == 1 and "recent_workouts" not in profile

    client_for(tobi).post(f"/api/profiles/{edu.id}/follow/")
    profile = edu_client.get(f"/api/profiles/{tobi.id}/").json()
    assert profile["is_friend"] is True and profile["recent_workouts"][0]["name"] == "Espalda"
    assert [p["name"] for p in edu_client.get("/api/profiles/").json()] == ["Tobi"]
    assert edu_client.get("/api/profiles/?search=t").json() == []
    assert {p["name"] for p in edu_client.get("/api/profiles/?search=to").json()} == {"Tobi", "Tomi"}


@pytest.mark.django_db
def test_messages_only_between_friends(people):
    edu, tobi, stranger = people["edu"], people["tobi"], people["extraño"]
    assert client_for(stranger).post("/api/messages/", {"recipient": str(edu.id), "text": "hola"}, format="json").status_code == 403
    befriend(edu, tobi)
    assert client_for(tobi).post("/api/messages/", {"recipient": str(edu.id), "text": "¿Entrenamos?"}, format="json").status_code == 201
    edu_client = client_for(edu)
    assert edu_client.get("/api/messages/unread/").json() == {"count": 1}
    conversations = edu_client.get("/api/messages/").json()
    assert conversations[0]["with"]["name"] == "Tobi" and conversations[0]["unread"] == 1
    thread = edu_client.get(f"/api/messages/?with={tobi.id}").json()
    assert thread["can_write"] is True and [m["text"] for m in thread["messages"]] == ["¿Entrenamos?"]
    assert edu_client.get("/api/messages/unread/").json() == {"count": 0}


@pytest.mark.django_db
def test_achievements_unlock_when_workout_finishes(people):
    edu = people["edu"]
    workout = Workout.objects.create(user=edu, started_at="2026-09-30T10:00:00Z")
    WorkoutExercise.objects.create(workout=workout, exercise=Exercise.objects.create(name="Sentadilla", slug="sentadilla"))
    client = client_for(edu)
    finished = client.post(f"/api/workouts/{workout.id}/finish/").json()
    assert finished["unlocked_achievements"][0]["title"] == "Primer paso"
    rows = client.get("/api/achievements/").json()
    assert any(r["code"] == "first_workout" and r["unlocked_at"] for r in rows)


@pytest.mark.django_db
def test_post_photo_is_stored_without_cloudinary(people):
    client = client_for(people["edu"])
    post = client.post("/api/posts/?with_photo=1", {"text": ""}, format="json").json()
    data = client.put(f"/api/posts/{post['id']}/photo/", b"\xff\xd8\xff" + b"0" * 40, content_type="image/jpeg").json()
    assert f"/api/post-photos/{post['id']}/" in data["image_url"]
    assert APIClient().get(f"/api/post-photos/{post['id']}/")["Content-Type"] == "image/jpeg"


@pytest.mark.django_db
def test_notifications_for_follow_message_comment_and_achievement(people):
    edu, tobi = people["edu"], people["tobi"]
    tobi_client, edu_client = client_for(tobi), client_for(edu)
    tobi_client.post(f"/api/profiles/{edu.id}/follow/")
    edu_client.post(f"/api/profiles/{tobi.id}/follow/")  # ahora son amigos
    tobi_client.post("/api/messages/", {"recipient": str(edu.id), "text": "Hola"}, format="json")
    tobi_client.post("/api/messages/", {"recipient": str(edu.id), "text": "¿Vamos al gym?"}, format="json")
    post = edu_client.post("/api/posts/", {"text": "Día de piernas"}, format="json").json()
    tobi_client.post(f"/api/posts/{post['id']}/comments/", {"text": "Bien ahí"}, format="json")
    edu_client.post(f"/api/posts/{post['id']}/comments/", {"text": "Gracias"}, format="json")  # comentar lo propio no avisa
    workout = Workout.objects.create(user=edu, started_at="2026-09-30T10:00:00Z")
    edu_client.post(f"/api/workouts/{workout.id}/finish/")

    rows = edu_client.get("/api/notifications/").json()
    kinds = [r["kind"] for r in rows]
    assert kinds.count("message") == 1 and "¿Vamos al gym?" in next(r["text"] for r in rows if r["kind"] == "message")
    assert {"follow", "comment", "achievement"} <= set(kinds)
    assert "ahora son amigos" in next(r["text"] for r in client_for(tobi).get("/api/notifications/").json() if r["kind"] == "follow").lower()
    assert edu_client.get("/api/notifications/unread/").json()["count"] == len(rows)
    edu_client.post("/api/notifications/read-all/")
    assert edu_client.get("/api/notifications/unread/").json()["count"] == 0



@pytest.mark.django_db
def test_likes_are_grouped_in_one_notification_per_post(people):
    edu, tobi, tomi = people["edu"], people["tobi"], people["tomi"]
    post = client_for(edu).post("/api/posts/", {"text": "PR en banca", "visibility": "public"}, format="json").json()
    client_for(tobi).post(f"/api/posts/{post['id']}/like/")
    client_for(tomi).post(f"/api/posts/{post['id']}/like/")
    client_for(edu).post(f"/api/posts/{post['id']}/like/")  # like propio: sin aviso
    likes = [n for n in client_for(edu).get("/api/notifications/").json() if n["kind"] == "like"]
    assert len(likes) == 1 and likes[0]["text"] == "A Tomi y 1 más les gustó tu publicación"


@pytest.mark.django_db
def test_people_search_ignores_accents_and_case(people):
    User.objects.create_user("tomas.g@example.com", name="Tomás Guzmán")
    names = {p["name"] for p in client_for(people["edu"]).get("/api/profiles/?search=TOMAS guz").json()}
    assert names == {"Tomás Guzmán"}


@pytest.mark.django_db
def test_friends_see_and_save_each_others_routines(people):
    from workouts.models import Routine, RoutineExercise
    edu, tobi, stranger = people["edu"], people["tobi"], people["extraño"]
    squat = Exercise.objects.create(name="Squat", name_es="Sentadilla", slug="squat")
    routine = Routine.objects.create(user=tobi, name="Piernas de Tobi")
    RoutineExercise.objects.create(routine=routine, exercise=squat, order=0, target_sets=4, target_reps="8")
    Routine.objects.create(user=tobi, name="Vacía")  # sin ejercicios: no se muestra

    assert "routines" not in client_for(stranger).get(f"/api/profiles/{tobi.id}/").json()
    assert client_for(stranger).post(f"/api/profiles/{tobi.id}/routines/{routine.id}/save/").status_code == 403

    befriend(edu, tobi)
    profile = client_for(edu).get(f"/api/profiles/{tobi.id}/").json()
    assert [(r["name"], r["exercises"]) for r in profile["routines"]] == [("Piernas de Tobi", ["Sentadilla"])]
    saved = client_for(edu).post(f"/api/profiles/{tobi.id}/routines/{routine.id}/save/").json()
    assert saved["name"] == "Piernas de Tobi" and saved["items"][0]["target_sets"] == 4
    assert Routine.objects.filter(user=edu, name="Piernas de Tobi").exists()
    assert any(n["kind"] == "routine" for n in client_for(tobi).get("/api/notifications/").json())
