from django.core.management.base import BaseCommand, CommandError

from users.models import User


class Command(BaseCommand):
    help = "Da (o quita con --remove) permisos de administrador a un usuario existente"

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--remove", action="store_true")

    def handle(self, *args, **opts):
        user = User.objects.filter(email__iexact=opts["email"]).first()
        if user is None:
            raise CommandError("No existe un usuario con ese email. Iniciá sesión en la app primero.")
        user.is_staff = not opts["remove"]
        user.save(update_fields=["is_staff"])
        self.stdout.write(f"{user.email}: admin={'sí' if user.is_staff else 'no'}")
