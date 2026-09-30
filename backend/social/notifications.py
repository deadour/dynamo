from django.utils import timezone

from .models import Notification


def _name(user):
    return user.name or user.email.split("@")[0]


def notify(user, kind, text, actor=None, icon="", link=""):
    if actor is not None and actor.id == user.id:
        return None
    return Notification.objects.create(user=user, kind=kind, actor=actor, text=text[:200], icon=icon, link=link)


def notify_follow(follower, followed, mutual):
    text = f"{_name(follower)} te sigue. ¡Ahora son amigos!" if mutual else f"{_name(follower)} empezó a seguirte"
    return notify(followed, "follow", text, actor=follower, link=f"/usuario?id={follower.id}")


def notify_message(sender, recipient, body):
    # Un solo aviso sin leer por conversación: se actualiza en vez de apilar uno por mensaje.
    existing = Notification.objects.filter(user=recipient, kind="message", actor=sender, read_at__isnull=True).first()
    text = f"{_name(sender)}: {body}"[:200]
    if existing:
        existing.text, existing.created_at = text, timezone.now()
        existing.save(update_fields=["text", "created_at"])
        return existing
    return notify(recipient, "message", text, actor=sender, link=f"/mensajes?with={sender.id}")


def notify_comment(commenter, post):
    return notify(post.user, "comment", f"{_name(commenter)} comentó tu publicación", actor=commenter, link="/amigos")


def notify_achievements(user, unlocked):
    for row in unlocked:
        notify(user, "achievement", f"Desbloqueaste «{row.achievement.title}»", icon=row.achievement.icon, link="/perfil")


def notify_like(liker, post):
    """Un aviso por publicación: los likes nuevos se agrupan en el mismo aviso mientras no se lea."""
    if liker.id == post.user_id:
        return None
    link = f"/amigos#post-{post.id}"
    others = post.likes.exclude(user=liker).count()
    text = f"A {_name(liker)} le gustó tu publicación" if others == 0 else f"A {_name(liker)} y {others} más les gustó tu publicación"
    existing = Notification.objects.filter(user=post.user, kind="like", link=link, read_at__isnull=True).first()
    if existing:
        existing.text, existing.actor, existing.created_at = text, liker, timezone.now()
        existing.save(update_fields=["text", "actor", "created_at"])
        return existing
    return notify(post.user, "like", text, actor=liker, link=link)


def notify_routine_saved(saver, routine):
    return notify(routine.user, "routine", f"{_name(saver)} guardó tu rutina «{routine.name}»", actor=saver, link=f"/usuario?id={saver.id}")
