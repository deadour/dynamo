import unicodedata


def normalize(text):
    """Texto para buscar sin importar tildes ni mayúsculas: "Tomás" -> "tomas", "Bíceps" -> "biceps"."""
    decomposed = unicodedata.normalize("NFKD", text or "")
    return " ".join("".join(c for c in decomposed if not unicodedata.combining(c)).lower().split())
