from rest_framework import serializers

from .models import Achievement, Comment, DirectMessage, Post, UserAchievement


def display_name(user):
    return user.name or user.email.split("@")[0]


def author(user):
    return {"id": str(user.id), "name": display_name(user), "avatar_url": user.avatar_url}


def workout_summary(workout):
    exercises = list(workout.exercises.all())
    sets = [s for e in exercises for s in e.sets.all() if s.completed]
    minutes = int((workout.finished_at - workout.started_at).total_seconds() // 60) if workout.finished_at else None
    return {
        "name": workout.name,
        "date": workout.started_at,
        "duration_min": minutes,
        "exercise_count": len(exercises),
        "set_count": len(sets),
        "volume": round(sum(float(s.weight_kg) * s.reps for s in sets)),
        "exercises": [e.exercise.name_es or e.exercise.name for e in exercises[:4]],
    }


class AchievementSerializer(serializers.ModelSerializer):
    unlocked_at = serializers.SerializerMethodField()

    class Meta:
        model = Achievement
        fields = ["code", "title", "description", "icon", "metric", "target", "unlocked_at"]
        read_only_fields = fields

    def get_unlocked_at(self, obj):
        unlock = getattr(obj, "user_unlock", None)
        return unlock.unlocked_at if unlock else None


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "text", "author", "created_at"]
        read_only_fields = ["id", "author", "created_at"]

    def get_author(self, obj):
        return author(obj.user)

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Escribí algo.")
        return value


class PostSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True, source="like_total", default=0)
    comment_count = serializers.IntegerField(read_only=True, source="comment_total", default=0)
    liked = serializers.BooleanField(read_only=True, source="liked_by_me", default=False)
    workout_summary = serializers.SerializerMethodField()
    achievement_info = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ["id", "text", "post_type", "visibility", "image_url", "workout", "achievement", "author", "is_mine", "like_count", "comment_count", "liked", "workout_summary", "achievement_info", "created_at"]
        read_only_fields = ["id", "post_type", "image_url", "author", "is_mine", "like_count", "comment_count", "liked", "workout_summary", "achievement_info", "created_at"]
        extra_kwargs = {"achievement": {"write_only": True}, "workout": {"write_only": True}}

    def get_author(self, obj):
        row = author(obj.user)
        following = self.context.get("following")
        if following is not None:
            row["is_following"] = obj.user_id in following
        return row

    def get_is_mine(self, obj):
        return obj.user_id == self.context["request"].user.id

    def get_workout_summary(self, obj):
        return workout_summary(obj.workout) if obj.workout_id else None

    def get_achievement_info(self, obj):
        a = obj.achievement
        return {"title": a.title, "icon": a.icon, "description": a.description} if a else None

    def validate_text(self, value):
        return value.strip()

    def validate(self, attrs):
        user = self.context["request"].user
        workout, achievement = attrs.get("workout"), attrs.get("achievement")
        # Solo se puede compartir lo propio: nunca el entrenamiento o logro de otra persona.
        if workout and workout.user_id != user.id:
            raise serializers.ValidationError({"workout": "Solo podés compartir tus entrenamientos."})
        if achievement and not UserAchievement.objects.filter(user=user, achievement=achievement).exists():
            raise serializers.ValidationError({"achievement": "Todavía no desbloqueaste ese logro."})
        if self.instance is None and not (attrs.get("text") or workout or achievement or self.context.get("with_photo")):
            raise serializers.ValidationError({"text": "Escribí algo o compartí un entrenamiento."})
        attrs["post_type"] = "workout" if workout else "achievement" if achievement else "text"
        return attrs


class DirectMessageSerializer(serializers.ModelSerializer):
    mine = serializers.SerializerMethodField()

    class Meta:
        model = DirectMessage
        fields = ["id", "recipient", "text", "mine", "read_at", "created_at"]
        read_only_fields = ["id", "mine", "read_at", "created_at"]

    def get_mine(self, obj):
        return obj.sender_id == self.context["request"].user.id

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El mensaje está vacío.")
        return value
