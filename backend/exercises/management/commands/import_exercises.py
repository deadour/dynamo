import json
from urllib.request import urlopen

from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify

from exercises.models import Exercise
from exercises.translations import spanish_exercise_name

DATASET_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
IMAGE_BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"


class Command(BaseCommand):
    help = "Importa ejercicios desde free-exercise-db o un JSON compatible"

    def add_arguments(self, parser):
        parser.add_argument("--file", default="", help="JSON local compatible con free-exercise-db")
        parser.add_argument("--url", default=DATASET_URL, help="URL del JSON del dataset")

    def _load(self, file_path, url):
        if file_path:
            with open(file_path, encoding="utf-8") as source:
                return json.load(source)
        with urlopen(url, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))

    @staticmethod
    def _image_url(value):
        if not value:
            return ""
        if value.startswith(("http://", "https://")):
            return value
        return IMAGE_BASE_URL + value.lstrip("/")

    def handle(self, *args, **opts):
        try:
            data = self._load(opts["file"], opts["url"])
        except (OSError, ValueError) as exc:
            raise CommandError(f"No se pudo leer el dataset: {exc}") from exc

        created = updated = skipped = errors = 0
        fields = ["name", "name_es", "slug", "category", "primary_muscles", "secondary_muscles", "equipment", "difficulty", "instructions", "image_1", "image_2", "source", "source_url"]
        existing = {item.external_id: item for item in Exercise.objects.filter(external_id__isnull=False)}
        new_items = []
        changed_items = []
        for row in data:
            external_id = row.get("id")
            name = row.get("name")
            if not external_id or not name:
                skipped += 1
                continue
            try:
                images = row.get("images") or []
                defaults = {
                    "name": name,
                    "name_es": spanish_exercise_name(name),
                    "slug": slugify(name),
                    "category": row.get("category") or "",
                    "primary_muscles": row.get("primaryMuscles") or [],
                    "secondary_muscles": row.get("secondaryMuscles") or [],
                    "equipment": row.get("equipment") or "",
                    "difficulty": row.get("level") or "",
                    "instructions": row.get("instructions") or [],
                    "image_1": self._image_url(images[0]) if images else "",
                    "image_2": self._image_url(images[1]) if len(images) > 1 else "",
                    "source": "free-exercise-db",
                    "source_url": "https://github.com/yuhonas/free-exercise-db",
                }
                item = existing.get(external_id)
                if item is None:
                    new_items.append(Exercise(external_id=external_id, **defaults))
                    created += 1
                else:
                    for field, value in defaults.items():
                        setattr(item, field, value)
                    changed_items.append(item)
                    updated += 1
            except Exception as exc:  # pragma: no cover - protects long imports from one bad row
                errors += 1
                self.stderr.write(f"error={external_id}: {exc}")
        if new_items:
            Exercise.objects.bulk_create(new_items, batch_size=100)
        if changed_items:
            Exercise.objects.bulk_update(changed_items, fields, batch_size=100)
        self.stdout.write(f"creados={created} actualizados={updated} omitidos={skipped} errores={errors}")
