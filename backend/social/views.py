from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Q
import time

from django.http import HttpResponse
from django.urls import reverse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from bodymetrics.views import ImageParser, detect_image_type
from media_utils import delete_image, upload_image
from search_utils import normalize
from users.models import User
from workouts.models import Routine, Workout
from workouts.serializers import RoutineSerializer

from .achievements import ensure_definitions
from .models import Achievement, Comment, DirectMessage, Follow, Notification, Post, PostLike, UserAchievement
from .notifications import notify_comment, notify_follow, notify_like, notify_message, notify_routine_saved
from .serializers import AchievementSerializer, CommentSerializer, DirectMessageSerializer, PostSerializer, display_name, workout_summary

MAX_POST_PHOTO_BYTES = 3_000_000


def following_ids(user):
    return set(Follow.objects.filter(follower=user).values_list("following_id", flat=True))


def friend_ids(user):
    """Amigos = seguimiento mutuo."""
    return following_ids(user) & set(Follow.objects.filter(following=user).values_list("follower_id", flat=True))


DEMO_DOMAIN = "@demo.dynamo.app"


def is_demo(user):
    return (user.email or "").endswith(DEMO_DOMAIN)


def without_demo(qs, viewer, field="email"):
    """Las cuentas de demo (seed_demo) solo se ven entre ellas: los usuarios reales nunca se las cruzan."""
    return qs if is_demo(viewer) else qs.exclude(**{f"{field}__endswith": DEMO_DOMAIN})


def visible_posts(user):
    """Publicaciones que el usuario puede ver: las suyas, las públicas y las de amigos marcadas "solo amigos"."""
    qs = Post.objects.filter(Q(user=user) | Q(visibility="public") | Q(visibility="friends", user_id__in=friend_ids(user)))
    return without_demo(qs, user, "user__email")


class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = visible_posts(user)
        author_id = self.request.query_params.get("user")
        if self.action == "list":
            # Feed: lo mío + la gente que sigo + lo público de cualquiera. En un perfil: solo las publicaciones de esa persona.
            qs = qs.filter(user_id=author_id) if author_id else qs.filter(Q(user=user) | Q(user_id__in=following_ids(user)) | Q(visibility="public"))
        return (qs.select_related("user", "achievement", "workout")
                .prefetch_related("workout__exercises__sets", "workout__exercises__exercise")
                .annotate(like_total=Count("likes", distinct=True), comment_total=Count("comments", distinct=True),
                          liked_by_me=Exists(PostLike.objects.filter(post=OuterRef("pk"), user=user)))
                .order_by("-created_at"))

    def get_serializer_context(self):
        context = {**super().get_serializer_context(), "with_photo": self.request.query_params.get("with_photo") == "1"}
        if self.request.user.is_authenticated:
            context["following"] = following_ids(self.request.user)
        return context

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def _own(self, post):
        if post.user_id != self.request.user.id:
            raise PermissionDenied("Solo podés modificar tus publicaciones.")
        return post

    def perform_update(self, serializer):
        self._own(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._own(instance)
        delete_image(instance.image_public_id)
        instance.delete()

    @action(detail=True, methods=["post"])
    def like(self, request, pk=None):
        post = self.get_object()
        like, created = PostLike.objects.get_or_create(post=post, user=request.user)
        if created:
            notify_like(request.user, post)
        else:
            like.delete()
        return Response({"liked": created, "like_count": post.likes.count()})

    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method == "GET":
            return Response(CommentSerializer(post.comments.select_related("user"), many=True).data)
        serializer = CommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(post=post, user=request.user)
        notify_comment(request.user, post)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"comments/(?P<comment_id>[^/.]+)")
    def delete_comment(self, request, pk=None, comment_id=None):
        post = self.get_object()
        comment = get_object_or_404(Comment, pk=comment_id, post=post)
        if request.user.id not in (comment.user_id, post.user_id):
            raise PermissionDenied("No podés borrar este comentario.")
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["put"], parser_classes=[ImageParser])
    def photo(self, request, pk=None):
        post = self._own(self.get_object())
        data = request.data if isinstance(request.data, bytes) else b""
        content_type = detect_image_type(data)
        if content_type is None or len(data) > MAX_POST_PHOTO_BYTES:
            return Response({"detail": "Subí una imagen JPG, PNG o WebP de hasta 3 MB."}, status=400)
        uploaded = upload_image(data, "dynamo/posts")
        delete_image(post.image_public_id)
        if uploaded:
            post.photo, post.photo_type = None, ""
            post.image_url, post.image_public_id = uploaded["url"], uploaded["public_id"]
        else:  # sin Cloudinary: se guarda en la base
            post.photo, post.photo_type, post.image_public_id = data, content_type, ""
            post.image_url = request.build_absolute_uri(reverse("post-photo", args=[post.id])) + f"?v={int(time.time())}"
        post.save(update_fields=["photo", "photo_type", "image_url", "image_public_id", "updated_at"])
        return Response(self.get_serializer(self.get_queryset().get(pk=post.pk)).data)


def profile_row(person, me, following, followers):
    return {
        "id": str(person.id), "name": display_name(person), "avatar_url": person.avatar_url,
        "is_following": person.id in following, "follows_you": person.id in followers,
        "is_friend": person.id in following and person.id in followers,
    }


def training_stats(user):
    since = timezone.now() - timedelta(days=30)
    recent = Workout.objects.filter(user=user, started_at__gte=since).prefetch_related("exercises__sets")
    volume = sum(float(s.weight_kg) * s.reps for w in recent for e in w.exercises.all() for s in e.sets.all() if s.completed)
    return {"workouts_total": Workout.objects.filter(user=user).count(), "workouts_30d": len(recent), "volume_30d": round(volume)}


class ProfileViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "id"

    def get_queryset(self):
        return without_demo(User.objects.filter(is_active=True), self.request.user)

    def _relations(self):
        me = self.request.user
        return following_ids(me), set(Follow.objects.filter(following=me).values_list("follower_id", flat=True))

    def list(self, request):
        me = request.user
        following, followers = self._relations()
        tab = request.query_params.get("tab", "")
        term = request.query_params.get("search", "").strip()
        of = request.query_params.get("user")
        if of and tab in ("followers", "following") and not term:
            # Seguidores / seguidos de cualquier persona (se ven desde su perfil).
            person = get_object_or_404(self.get_queryset(), pk=of)
            ids = (Follow.objects.filter(following=person).values_list("follower_id", flat=True) if tab == "followers"
                   else Follow.objects.filter(follower=person).values_list("following_id", flat=True))
            people = self.get_queryset().filter(id__in=list(ids)).order_by("name")
            return Response([{**profile_row(p, me, following, followers), "is_me": p.id == me.id} for p in people])
        if tab == "suggested" and not term:
            return Response(self._suggested(me, following, followers))
        if term:
            if len(term) < 2:
                return Response([])
            people = self.get_queryset().filter(Q(search_name__contains=normalize(term)) | Q(email__iexact=term)).exclude(id=me.id).order_by("name")[:20]
        elif tab == "followers":
            people = self.get_queryset().filter(id__in=followers)
        elif tab == "following":
            people = self.get_queryset().filter(id__in=following)
        else:  # amigos
            people = self.get_queryset().filter(id__in=following & followers)
        return Response([profile_row(p, me, following, followers) for p in (people if term else people.order_by("name"))])

    def _suggested(self, me, following, followers, limit=20):
        """Gente para seguir sin tener que buscar, en este orden:
        1. conectados con alguien que sigo: los que siguen esas personas o los que las siguen (más conexiones primero);
        2. los que me siguen y todavía no sigo;
        3. el resto de la gente, primero los que más entrenaron últimamente (así nunca queda vacío)."""
        skip = following | {me.id}
        names = {u.id: display_name(u) for u in self.get_queryset().filter(id__in=following)}
        score, followed_by, follows = {}, {}, {}
        for src, dst in Follow.objects.filter(follower_id__in=following).exclude(following_id__in=skip).values_list("follower_id", "following_id"):
            score[dst] = score.get(dst, 0) + 2  # lo sigue alguien que sigo: señal más fuerte
            followed_by.setdefault(dst, src)
        for src, dst in Follow.objects.filter(following_id__in=following).exclude(follower_id__in=skip).values_list("follower_id", "following_id"):
            score[src] = score.get(src, 0) + 1  # sigue a alguien que sigo
            follows.setdefault(src, dst)
        for pk in followers - skip:
            score[pk] = score.get(pk, 0) + 3  # me sigue: seguirlo nos hace amigos
        since = timezone.now() - timedelta(days=30)
        people = (self.get_queryset().exclude(id__in=skip)
                  .annotate(recent=Count("workouts", filter=Q(workouts__started_at__gte=since), distinct=True), total=Count("workouts", distinct=True)))
        # los conectados conmigo + los más activos del resto (sin recorrer toda la base)
        candidates = list(people.filter(id__in=list(score))) + list(people.exclude(id__in=list(score)).order_by("-recent", "-total", "-created_at")[:limit])
        ranked = sorted(candidates, key=lambda p: (-score.get(p.id, 0), -p.recent, -p.total, -p.created_at.timestamp()))[:limit]
        rows = []
        for p in ranked:
            row = profile_row(p, me, following, followers)
            connections = (1 if p.id in followed_by else 0) + (1 if p.id in follows else 0)
            if p.id in followers:
                row["reason"] = "Te sigue"
            elif p.id in followed_by:
                row["reason"] = f"Lo sigue {names.get(followed_by[p.id], 'alguien que seguís')}"
            elif p.id in follows:
                row["reason"] = f"Sigue a {names.get(follows[p.id], 'alguien que seguís')}"
            elif p.recent:
                row["reason"] = f"{p.recent} {'entreno' if p.recent == 1 else 'entrenos'} este mes"
            else:
                row["reason"] = "Nuevo en Dynamo" if (timezone.now() - p.created_at).days < 14 else "En Dynamo"
            row["in_network"] = bool(connections) or p.id in followers
            rows.append(row)
        return rows

    def retrieve(self, request, id=None):
        me = request.user
        person = self.get_object()
        following, followers = self._relations()
        row = profile_row(person, me, following, followers)
        unlocked = UserAchievement.objects.filter(user=person).select_related("achievement")
        row.update({
            "is_me": person.id == me.id,
            "followers": Follow.objects.filter(following=person).count(),
            "following": Follow.objects.filter(follower=person).count(),
            "stats": training_stats(person),
            "my_stats": training_stats(me),
            "achievements": [{"title": u.achievement.title, "icon": u.achievement.icon, "description": u.achievement.description} for u in unlocked],
        })
        # El detalle de los entrenamientos lo ven solo los amigos (o uno mismo).
        if row["is_friend"] or row["is_me"]:
            workouts = Workout.objects.filter(user=person).prefetch_related("exercises__sets", "exercises__exercise")[:5]
            row["recent_workouts"] = [workout_summary(w) for w in workouts]
            from workouts.views import training_days
            row["calendar"] = training_days(person)
            routines = Routine.objects.filter(user=person).prefetch_related("items__exercise")
            saved = {} if row["is_me"] else dict(Routine.objects.filter(user=me, source__user=person).values_list("source_id", "id"))
            row["routines"] = [{
                "id": str(r.id), "name": r.name, "notes": r.notes, "exercise_count": len(r.items.all()),
                "exercises": [i.exercise.name_es or i.exercise.name for i in list(r.items.all())[:4]],
                "images": [i.exercise.image_1 for i in r.items.all() if i.exercise.image_1][:3],
                "items": [{"exercise": str(i.exercise_id), "name": i.exercise.name_es or i.exercise.name, "image": i.exercise.image_1,
                           "target_sets": i.target_sets, "target_reps": i.target_reps} for i in r.items.all()],
                "saved_id": str(saved[r.id]) if r.id in saved else None,
            } for r in routines if r.items.all()]
        return Response(row)

    @action(detail=True, methods=["post", "delete"], url_path=r"routines/(?P<routine_id>[^/.]+)/save")
    def save_routine(self, request, id=None, routine_id=None):
        """Guardar en mi cuenta una rutina de un amigo. DELETE lo deshace (borra mi copia)."""
        person = self.get_object()
        mine = Routine.objects.filter(user=request.user, source_id=routine_id, source__user=person)
        if request.method == "DELETE":
            mine.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        if mine.exists():
            return Response(RoutineSerializer(mine.prefetch_related("items__exercise").first(), context={"request": request}).data)
        if person.id not in friend_ids(request.user):
            raise PermissionDenied("Solo podés guardar rutinas de tus amigos.")
        from workouts.views import copy_routine
        source = get_object_or_404(Routine.objects.prefetch_related("items__exercise"), pk=routine_id, user=person)
        routine = copy_routine(source, request.user, source.name)
        notify_routine_saved(request.user, source)
        return Response(RoutineSerializer(routine, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post", "delete"])
    def follow(self, request, id=None):
        person = self.get_object()
        if person.id == request.user.id:
            raise ValidationError("No podés seguirte a vos mismo.")
        if request.method == "POST":
            _, created = Follow.objects.get_or_create(follower=request.user, following=person)
            if created:
                notify_follow(request.user, person, mutual=Follow.objects.filter(follower=person, following=request.user).exists())
        else:
            Follow.objects.filter(follower=request.user, following=person).delete()
        following, followers = self._relations()
        return Response(profile_row(person, request.user, following, followers))


class MessageViewSet(viewsets.ViewSet):
    """Mensajes directos, solo entre amigos (seguimiento mutuo). MVP sin moderación."""

    def list(self, request):
        me = request.user
        other_id = request.query_params.get("with")
        if other_id:
            other = get_object_or_404(User, pk=other_id)
            thread = DirectMessage.objects.filter(Q(sender=me, recipient=other) | Q(sender=other, recipient=me))
            thread.filter(recipient=me, read_at__isnull=True).update(read_at=timezone.now())
            return Response({"with": {"id": str(other.id), "name": display_name(other), "avatar_url": other.avatar_url},
                             "can_write": other.id in friend_ids(me),
                             "messages": DirectMessageSerializer(thread.order_by("created_at")[:200], many=True, context={"request": request}).data})
        conversations = {}
        for m in DirectMessage.objects.filter(Q(sender=me) | Q(recipient=me)).select_related("sender", "recipient").order_by("-created_at")[:300]:
            other = m.recipient if m.sender_id == me.id else m.sender
            conv = conversations.setdefault(other.id, {"with": {"id": str(other.id), "name": display_name(other), "avatar_url": other.avatar_url}, "last": m.text, "last_at": m.created_at, "unread": 0})
            if m.recipient_id == me.id and m.read_at is None:
                conv["unread"] += 1
        return Response(list(conversations.values()))

    def create(self, request):
        serializer = DirectMessageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        recipient = serializer.validated_data["recipient"]
        if recipient.id not in friend_ids(request.user):
            raise PermissionDenied("Solo podés escribirle a tus amigos (se siguen mutuamente).")
        message = serializer.save(sender=request.user)
        notify_message(request.user, recipient, message.text)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def unread(self, request):
        return Response({"count": DirectMessage.objects.filter(recipient=request.user, read_at__isnull=True).count()})


class AchievementViewSet(viewsets.ViewSet):
    def list(self, request):
        ensure_definitions()
        unlocked = {u.achievement_id: u for u in UserAchievement.objects.filter(user=request.user)}
        rows = []
        for achievement in Achievement.objects.order_by("metric", "target"):
            achievement.user_unlock = unlocked.get(achievement.id)
            rows.append(achievement)
        return Response(AchievementSerializer(rows, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def post_photo(request, post_id):
    """Fotos de publicaciones guardadas en la base (cuando Cloudinary no está configurado)."""
    post = Post.objects.filter(pk=post_id).only("photo", "photo_type").first()
    if post is None or not post.photo_type:
        return HttpResponse(status=404)
    response = HttpResponse(bytes(post.photo), content_type=post.photo_type)
    response["Cache-Control"] = "public, max-age=604800"
    return response


class NotificationViewSet(viewsets.ViewSet):
    def list(self, request):
        rows = Notification.objects.filter(user=request.user).select_related("actor")[:50]
        return Response([{
            "id": n.id, "kind": n.kind, "text": n.text, "icon": n.icon, "link": n.link, "read": n.read_at is not None, "created_at": n.created_at,
            "actor": {"id": str(n.actor.id), "name": display_name(n.actor), "avatar_url": n.actor.avatar_url} if n.actor else None,
        } for n in rows])

    @action(detail=False, methods=["get"])
    def unread(self, request):
        return Response({"count": Notification.objects.filter(user=request.user, read_at__isnull=True).count()})

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)
