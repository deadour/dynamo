from rest_framework import serializers
from django.utils.text import slugify
from .models import Exercise
class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        exclude = ["photo", "photo_type"]
        read_only_fields = ["id", "external_id", "created_by", "active", "source", "source_url", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False}}

    def validate(self, attrs):
        if not attrs.get("name", "").strip():
            raise serializers.ValidationError({"name": "El nombre es obligatorio."})
        if not attrs.get("slug"):
            attrs["slug"] = slugify(attrs["name"])
        return attrs



MUSCLES = {"abdominals", "abductors", "adductors", "biceps", "calves", "chest", "forearms", "glutes", "hamstrings", "lats", "lower back", "middle back", "neck", "quadriceps", "shoulders", "traps", "triceps"}
EQUIPMENT = {"", "barbell", "dumbbell", "cable", "machine", "body only", "e-z curl bar", "kettlebells", "bands", "exercise ball", "medicine ball", "foam roll", "other"}
CATEGORIES = {"strength", "stretching", "plyometrics", "powerlifting", "olympic weightlifting", "strongman", "cardio"}


class CustomExerciseSerializer(serializers.ModelSerializer):
    """Ejercicio creado a mano por un usuario: solo campos editables y valores conocidos."""

    class Meta:
        model = Exercise
        fields = ["id", "name", "primary_muscles", "secondary_muscles", "equipment", "category", "instructions_es"]
        read_only_fields = ["id"]

    def validate_name(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Poné un nombre de al menos 2 letras.")
        return value[:120]

    def _muscles(self, value, required):
        if not isinstance(value, list) or any(m not in MUSCLES for m in value):
            raise serializers.ValidationError("Músculo no válido.")
        if required and not value:
            raise serializers.ValidationError("Elegí al menos un músculo.")
        return list(dict.fromkeys(value))

    def validate_primary_muscles(self, value):
        return self._muscles(value, required=True)

    def validate_secondary_muscles(self, value):
        return self._muscles(value, required=False)

    def validate_equipment(self, value):
        if value not in EQUIPMENT:
            raise serializers.ValidationError("Equipamiento no válido.")
        return value

    def validate_category(self, value):
        if value not in CATEGORIES:
            raise serializers.ValidationError("Categoría no válida.")
        return value

    def validate_instructions_es(self, value):
        if not isinstance(value, list) or len(value) > 12 or any(not isinstance(v, str) or len(v) > 500 for v in value):
            raise serializers.ValidationError("Hasta 12 pasos de 500 caracteres.")
        return [v.strip() for v in value if v.strip()]

    def save(self, **kwargs):
        name = self.validated_data.get("name")
        if name:
            kwargs.update(name_es=name, slug=slugify(name) or "ejercicio")
        return super().save(**kwargs)

    def to_representation(self, instance):
        return ExerciseSerializer(instance, context=self.context).data
