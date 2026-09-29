import json
from django.core.management.base import BaseCommand
from exercises.models import Exercise
class Command(BaseCommand):
    help="Importa ejercicios desde un JSON compatible con free-exercise-db"
    def add_arguments(self,parser): parser.add_argument("--file",default="")
    def handle(self,*args,**opts):
        if not opts["file"]: self.stdout.write(self.style.WARNING("Usá --file dataset.json; no se descarga contenido remoto automáticamente.")); return
        data=json.load(open(opts["file"],encoding="utf8")); created=updated=skipped=0
        for row in data:
            if not row.get("id") or not row.get("name"): skipped+=1; continue
            obj, made=Exercise.objects.update_or_create(external_id=row["id"],defaults={"name":row["name"],"slug":row["name"].lower().replace(" ","-"),"category":row.get("category", ""),"primary_muscles":row.get("primaryMuscles",[]),"secondary_muscles":row.get("secondaryMuscles",[]),"equipment":row.get("equipment", ""),"instructions":row.get("instructions",[]),"image_1":row.get("images",[""])[0] if row.get("images") else "","image_2":row.get("images",["",""])[1] if len(row.get("images",[]))>1 else "","source":"free-exercise-db","source_url":"https://github.com/yuhonas/free-exercise-db"}); created+=made; updated+=not made
        self.stdout.write(f"creados={created} actualizados={updated} omitidos={skipped}")
