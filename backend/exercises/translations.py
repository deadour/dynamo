import json
from functools import lru_cache
from pathlib import Path

NAMES_FILE = Path(__file__).parent / "data" / "names_es.json"
INSTRUCTIONS_FILE = Path(__file__).parent / "data" / "instructions_es.json"

# Respaldo para nombres que no están en names_es.json (por ej. ejercicios nuevos del dataset).
EXERCISE_NAMES_ES = {
    "bench press": "Press banca",
    "barbell bench press": "Press banca con barra",
    "incline bench press": "Press inclinado",
    "decline bench press": "Press declinado",
    "military press": "Press militar",
    "overhead press": "Press por encima de la cabeza",
    "dumbbell shoulder press": "Press de hombros con mancuernas",
    "pull up": "Dominadas",
    "chin up": "Dominadas supinas",
    "push up": "Flexiones",
    "dumbbell row": "Remo con mancuernas",
    "barbell row": "Remo con barra",
    "cable row": "Remo en polea",
    "lat pull down": "Jalón al pecho",
    "lat pulldown": "Jalón al pecho",
    "deadlift": "Peso muerto",
    "barbell squat": "Sentadilla con barra",
    "squat": "Sentadilla",
    "front squat": "Sentadilla frontal",
    "goblet squat": "Sentadilla copa",
    "leg press": "Prensa de piernas",
    "leg extension": "Extensión de piernas",
    "leg curl": "Curl femoral",
    "romanian deadlift": "Peso muerto rumano",
    "barbell curl": "Curl de bíceps con barra",
    "dumbbell curl": "Curl de bíceps con mancuernas",
    "hammer curl": "Curl martillo",
    "triceps pushdown": "Extensión de tríceps en polea",
    "triceps extension": "Extensión de tríceps",
    "calf raise": "Elevación de talones",
    "plank": "Plancha",
    "crunch": "Abdominales",
}


@lru_cache(maxsize=1)
def _names():
    with open(NAMES_FILE, encoding="utf-8") as source:
        return json.load(source)


def spanish_exercise_name(name):
    if name in _names():
        return _names()[name]
    normalized = " ".join(name.lower().replace("_", " ").replace("-", " ").split())
    return EXERCISE_NAMES_ES.get(normalized, name)


@lru_cache(maxsize=1)
def _instructions():
    with open(INSTRUCTIONS_FILE, encoding="utf-8") as source:
        return json.load(source)


def spanish_instructions(name):
    """Instrucciones en español (solo los ejercicios más comunes están traducidos)."""
    return _instructions().get(name, [])
