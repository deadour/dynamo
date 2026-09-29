from django.core.management.base import BaseCommand
from django.utils import timezone
from users.models import User
from exercises.models import Exercise
class Command(BaseCommand):
    def handle(self,*args,**kwargs):
        u,_=User.objects.get_or_create(email="demo@dynamo.local",defaults={"name":"Demo Dynamo"}); Exercise.objects.get_or_create(external_id="bench-press",defaults={"name":"Press banca","slug":"press-banca","category":"Fuerza","primary_muscles":["Pecho"],"equipment":"Barra","instructions":["Acostate en el banco","Empujá la barra"]}); self.stdout.write("Demo listo: demo@dynamo.local")
