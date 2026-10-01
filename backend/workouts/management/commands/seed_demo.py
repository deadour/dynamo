"""Cuenta de demo con ~1 mes de entrenamientos creíbles, para sacar capturas y mostrar la app.

    python manage.py seed_demo --password "..."   # crea la demo (falla si ya existe)
    python manage.py seed_demo --reset            # borra la demo anterior y la vuelve a crear
    python manage.py seed_demo --delete           # borra todas las cuentas de demo

Todas las cuentas usan emails @demo.dynamo.app. Los usuarios reales no las ven (ni en búsquedas, ni en
sugeridos, ni en el feed): solo se ven entre ellas. Así se pueden sacar capturas sin ensuciar la app.
"""
import random
import secrets
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from bodymetrics.models import BodyWeight
from exercises.models import Exercise
from social.achievements import sync_user_achievements
from social.models import Comment, Follow, Notification, Post, PostLike, UserAchievement
from users.models import User
from workouts.models import Routine, RoutineExercise, Workout, WorkoutExercise, WorkoutSet

DEMO_DOMAIN = "demo.dynamo.app"
TZ = ZoneInfo("America/Argentina/Buenos_Aires")

# nombre del dataset -> (peso inicial kg, aumento por semana, series, repes objetivo)
PLAN = {
    "Torso A": [("Barbell Bench Press - Medium Grip", 55, 2.5, 4, 8), ("Bent Over Barbell Row", 50, 2.5, 4, 10),
                ("Dumbbell Shoulder Press", 16, 2, 3, 10), ("Wide-Grip Lat Pulldown", 50, 5, 3, 12),
                ("Barbell Curl", 25, 2.5, 3, 12), ("Triceps Pushdown", 25, 2.5, 3, 12)],
    "Piernas A": [("Barbell Squat", 70, 5, 4, 8), ("Romanian Deadlift", 60, 5, 3, 10), ("Leg Press", 140, 10, 3, 12),
                  ("Lying Leg Curls", 35, 2.5, 3, 12), ("Standing Calf Raises", 60, 5, 4, 15)],
    "Torso B": [("Incline Dumbbell Press", 22, 2, 4, 10), ("Pullups", 0, 0, 4, 8), ("Seated Cable Rows", 55, 5, 3, 12),
                ("Side Lateral Raise", 8, 1, 3, 15), ("Hammer Curls", 14, 2, 3, 12), ("Dips - Triceps Version", 0, 0, 3, 10)],
    "Piernas B": [("Barbell Deadlift", 90, 5, 4, 5), ("Leg Press", 150, 10, 3, 10), ("Leg Extensions", 40, 5, 3, 12),
                  ("Lying Leg Curls", 35, 2.5, 3, 12), ("Standing Calf Raises", 60, 5, 4, 15)],
}
WEEK = {0: "Torso A", 1: "Piernas A", 3: "Torso B", 5: "Piernas B"}  # lunes, martes, jueves, sábado

PEOPLE = [
    # email, nombre, escala de pesos, asistencia, hora habitual
    ("eduardo", "Eduardo Ramírez", 1.0, 0.9, 16),
    ("jere", "Jere Torres", 1.15, 0.95, 15),
    ("gonzalo", "Gonzalo Saucedo", 1.05, 0.8, 18),
    ("tomas", "Tomás Guzmán", 0.9, 0.85, 20),
    ("flor", "Flor Silva", 0.55, 0.85, 9),
]


def demo_email(slug):
    return f"{slug}@{DEMO_DOMAIN}"


def round_weight(value, step):
    if value <= 0:
        return Decimal("0")
    step = 2.5 if step >= 2.5 else 1
    return Decimal(str(round(value / step) * step))


class Command(BaseCommand):
    help = "Crea (o borra) una cuenta de demo con un mes de entrenamientos para sacar capturas."

    def add_arguments(self, parser):
        parser.add_argument("--password", default="", help="Contraseña de la cuenta principal (si no, se genera una).")
        parser.add_argument("--days", type=int, default=35, help="Días de historial (por defecto 35).")
        parser.add_argument("--reset", action="store_true", help="Borra la demo existente y la vuelve a crear.")
        parser.add_argument("--delete", action="store_true", help="Solo borra las cuentas de demo.")
        parser.add_argument("--seed", type=int, default=7, help="Semilla para que los datos salgan siempre iguales.")

    def handle(self, *args, **opts):
        demo_users = User.objects.filter(email__endswith=f"@{DEMO_DOMAIN}")
        if opts["delete"] or opts["reset"]:
            count = demo_users.count()
            demo_users.delete()
            self.stdout.write(f"Cuentas de demo borradas: {count}")
            if opts["delete"]:
                return
        elif demo_users.exists():
            raise CommandError("La demo ya existe. Usá --reset para recrearla o --delete para borrarla.")

        self.rng = random.Random(opts["seed"])
        self.exercises = {e.name: e for e in Exercise.objects.filter(name__in={row[0] for rows in PLAN.values() for row in rows})}
        missing = {row[0] for rows in PLAN.values() for row in rows} - set(self.exercises)
        if missing:
            raise CommandError(f"Faltan ejercicios del catálogo (corré import_exercises): {', '.join(sorted(missing))}")

        password = opts["password"] or secrets.token_urlsafe(9)
        today = timezone.localdate(timezone=TZ)
        start = today - timedelta(days=opts["days"])
        with transaction.atomic():
            users = {}
            for slug, name, scale, attendance, hour in PEOPLE:
                user = User.objects.create_user(demo_email(slug), password=password if slug == "eduardo" else secrets.token_urlsafe(16), name=name)
                User.objects.filter(pk=user.pk).update(created_at=self._at(start - timedelta(days=3), 12))
                users[slug] = user
                self._routines(user)
                self._workouts(user, start, today, scale, attendance, hour)
                sync_user_achievements(user)
            self._weights(users["eduardo"], start, today)
            self._social(users, today)
        self.stdout.write(self.style.SUCCESS(self._summary(users["eduardo"], "(la que pasaste)" if opts["password"] else password)))

    # ---------- helpers ----------
    def _at(self, day, hour, minute=0):
        return datetime.combine(day, time(hour, minute), tzinfo=TZ)

    def _routines(self, user):
        for order, (name, rows) in enumerate(PLAN.items()):
            routine = Routine.objects.create(user=user, name=name, notes="Upper/lower, 4 días por semana." if order == 0 else "")
            RoutineExercise.objects.bulk_create([
                RoutineExercise(routine=routine, exercise=self.exercises[ex], order=i, target_sets=sets, target_reps=str(reps))
                for i, (ex, _w, _inc, sets, reps) in enumerate(rows)
            ])

    def _workouts(self, user, start, today, scale, attendance, hour):
        day = start
        while day < today:  # hoy queda libre para entrenar en vivo
            name = WEEK.get(day.weekday())
            if name and self.rng.random() < attendance:
                self._workout(user, name, day, (day - start).days // 7, scale, hour)
            day += timedelta(days=1)

    def _workout(self, user, name, day, block, scale, hour):
        started = self._at(day, hour, self.rng.choice([0, 10, 20, 30, 45]))
        minutes = self.rng.randint(52, 78)
        workout = Workout.objects.create(user=user, name=name, started_at=started, finished_at=started + timedelta(minutes=minutes))
        for order, (ex, base, inc, sets, reps) in enumerate(PLAN[name]):
            row = WorkoutExercise.objects.create(workout=workout, exercise=self.exercises[ex], order=order)
            weight = round_weight(base * scale + inc * scale * block, inc)
            rows, n = [], 1
            if order == 0 and weight > 20:  # calentamiento en el primer básico
                rows.append(WorkoutSet(workout_exercise=row, set_number=n, reps=10, weight_kg=round_weight(float(weight) * 0.5, inc), set_type="warmup"))
                n += 1
            for i in range(sets):
                done = reps - (self.rng.choice([0, 0, 1, 2]) if i == sets - 1 else self.rng.choice([0, 0, 0, 1]))
                rows.append(WorkoutSet(workout_exercise=row, set_number=n, reps=max(done, 1), weight_kg=weight))
                n += 1
            WorkoutSet.objects.bulk_create(rows)
        Workout.objects.filter(pk=workout.pk).update(created_at=started, updated_at=started + timedelta(minutes=minutes))

    def _weights(self, user, start, today):
        weight, day = 78.6, start
        while day <= today:
            BodyWeight.objects.create(user=user, date=day, weight_kg=Decimal(str(round(weight + self.rng.uniform(-0.3, 0.3), 1))))
            weight -= 0.05 * self.rng.choice([3, 4])  # baja ~1,5 kg en el mes
            day += timedelta(days=self.rng.choice([3, 4]))

    def _post(self, user, when, text="", visibility="friends", workout=None, achievement=None):
        post_type = "workout" if workout else "achievement" if achievement else "text"
        post = Post.objects.create(user=user, text=text, visibility=visibility, workout=workout, achievement=achievement, post_type=post_type)
        Post.objects.filter(pk=post.pk).update(created_at=when)
        return post

    def _social(self, users, today):
        edu, jere, gonza, tomi, flor = (users[k] for k in ("eduardo", "jere", "gonzalo", "tomas", "flor"))
        # amigos (se siguen todos entre sí): Jere, Gonzalo y Tomás · Flor aparece en sugeridos porque la sigue Jere
        crew = [edu, jere, gonza, tomi]
        Follow.objects.bulk_create([Follow(follower=a, following=b) for a in crew for b in crew if a != b])
        Follow.objects.create(follower=jere, following=flor)

        def last(user, name):
            return Workout.objects.filter(user=user, name=name).order_by("-started_at").first()

        now = timezone.now()
        squat = last(edu, "Piernas A")
        p1 = self._post(edu, squat.finished_at + timedelta(minutes=20), workout=squat)
        unlocked = UserAchievement.objects.filter(user=edu).select_related("achievement").order_by("-achievement__target").first()
        p2 = self._post(edu, now - timedelta(days=6), achievement=unlocked.achievement) if unlocked else None
        p3 = self._post(jere, now - timedelta(hours=4), "hoy gym 15 hs?")
        p4 = self._post(gonza, now - timedelta(days=1, hours=2), "hoy toca pierna")
        p5 = self._post(tomi, now - timedelta(days=2, hours=5), "estas para gym 20 hs?")
        for post, likers in ((p1, [jere, gonza, tomi]), (p2, [jere, tomi]), (p3, [gonza]), (p4, [edu, tomi]), (p5, [edu])):
            if post:
                PostLike.objects.bulk_create([PostLike(post=post, user=u) for u in likers])
        for post, user, text, ago in ((p3, edu, "16 puedo", timedelta(hours=3, minutes=40)), (p4, jere, "yo hago espalda hoy", timedelta(days=1, hours=1))):
            comment = Comment.objects.create(post=post, user=user, text=text)
            Comment.objects.filter(pk=comment.pk).update(created_at=now - ago)
        # avisos para que la campanita tenga algo (dos sin leer)
        Notification.objects.filter(user__in=users.values()).delete()
        for actor, text, kind, link, read, ago in (
            (jere, "A Jere Torres y 2 más les gustó tu publicación", "like", f"/amigos#post-{p1.id}", False, timedelta(hours=2)),
            (tomi, "Tomás Guzmán empezó a seguirte. ¡Ahora son amigos!", "follow", f"/usuario?id={tomi.id}", False, timedelta(hours=6)),
            (gonza, "A Gonzalo Saucedo le gustó tu publicación", "like", f"/amigos#post-{p2.id}" if p2 else "/amigos", True, timedelta(days=2)),
        ):
            n = Notification.objects.create(user=edu, actor=actor, kind=kind, text=text, link=link, read_at=now if read else None)
            Notification.objects.filter(pk=n.pk).update(created_at=now - ago)

    def _summary(self, user, password):
        workouts = Workout.objects.filter(user=user)
        sets = WorkoutSet.objects.filter(workout_exercise__workout__user=user, set_type="normal").count()
        bench = WorkoutSet.objects.filter(workout_exercise__workout__user=user, workout_exercise__exercise__name="Barbell Bench Press - Medium Grip", set_type="normal")
        squat = WorkoutSet.objects.filter(workout_exercise__workout__user=user, workout_exercise__exercise__name="Barbell Squat", set_type="normal")
        weights = list(BodyWeight.objects.filter(user=user).order_by("date").values_list("weight_kg", flat=True))
        span = lambda qs: f"{float(qs.order_by('workout_exercise__workout__started_at').first().weight_kg):g} → {float(qs.order_by('-workout_exercise__workout__started_at').first().weight_kg):g} kg"
        return "\n".join([
            "Demo lista.",
            f"  Cuenta: {user.email}  ·  contraseña: {password}",
            f"  Entrenamientos: {workouts.count()} ({sets} series)  ·  Rutinas: {Routine.objects.filter(user=user).count()}",
            f"  Press de banca: {span(bench)}  ·  Sentadilla: {span(squat)}",
            f"  Peso corporal: {float(weights[0]):g} → {float(weights[-1]):g} kg ({len(weights)} registros)",
            f"  Logros: {', '.join(UserAchievement.objects.filter(user=user).values_list('achievement__title', flat=True))}",
            "  Amigos: Jere Torres, Gonzalo Saucedo, Tomás Guzmán  ·  Sugerida: Flor Silva (la sigue Jere)",
        ])
