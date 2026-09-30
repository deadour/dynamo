import uuid

from django.conf import settings
from django.db import models

from workouts.models import Workout


class Achievement(models.Model):
    METRICS = [("workouts", "Entrenamientos"), ("streak_days", "Racha diaria"), ("active_weeks", "Semanas activas"), ("volume", "Volumen"), ("exercise_count", "Ejercicios")]
    code = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=120)
    description = models.CharField(max_length=255)
    icon = models.CharField(max_length=16, default="🏆")
    metric = models.CharField(max_length=20, choices=METRICS)
    target = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)


class UserAchievement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achievements")
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name="unlocks")
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "achievement"], name="unique_user_achievement")]
        ordering = ["-unlocked_at"]


class Follow(models.Model):
    """Seguir es unilateral; si los dos se siguen, son amigos."""
    follower = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following")
    following = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["follower", "following"], name="unique_user_follow")]


class Post(models.Model):
    TYPES = [("text", "Texto"), ("workout", "Entrenamiento"), ("achievement", "Logro")]
    VISIBILITY = [("public", "Pública"), ("friends", "Solo amigos")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts")
    text = models.TextField(blank=True, max_length=1000)
    post_type = models.CharField(max_length=20, choices=TYPES, default="text")
    visibility = models.CharField(max_length=10, choices=VISIBILITY, default="friends")
    image_url = models.URLField(blank=True)
    image_public_id = models.CharField(max_length=255, blank=True)
    photo = models.BinaryField(null=True, blank=True, editable=False)
    photo_type = models.CharField(max_length=20, blank=True)
    workout = models.ForeignKey(Workout, null=True, blank=True, on_delete=models.SET_NULL, related_name="posts")
    achievement = models.ForeignKey(Achievement, null=True, blank=True, on_delete=models.SET_NULL, related_name="posts")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]


class PostLike(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="unique_post_like")]


class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_comments")
    text = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class DirectMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_messages")
    text = models.CharField(max_length=1000)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["sender", "recipient", "created_at"])]


class Notification(models.Model):
    KINDS = [("achievement", "Logro"), ("follow", "Seguidor"), ("message", "Mensaje"), ("comment", "Comentario"), ("like", "Me gusta"), ("routine", "Rutina")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=KINDS)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="+")
    text = models.CharField(max_length=200)
    icon = models.CharField(max_length=16, blank=True)
    link = models.CharField(max_length=200, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "read_at"])]
