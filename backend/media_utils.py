"""Subida opcional de imágenes públicas a Cloudinary.

Si faltan las credenciales (CLOUDINARY_*), `upload_image` devuelve None y quien llama guarda la imagen
en la base. Las fotos de progreso nunca pasan por acá: son privadas y se sirven solo a su dueño.
"""
import io

from django.conf import settings


def cloudinary_enabled():
    config = getattr(settings, "CLOUDINARY_STORAGE", {})
    return all(config.get(key) for key in ("CLOUD_NAME", "API_KEY", "API_SECRET"))


def _uploader():
    import cloudinary
    import cloudinary.uploader

    config = settings.CLOUDINARY_STORAGE
    cloudinary.config(cloud_name=config["CLOUD_NAME"], api_key=config["API_KEY"], api_secret=config["API_SECRET"], secure=True)
    return cloudinary.uploader


def upload_image(data, folder):
    if not cloudinary_enabled():
        return None
    result = _uploader().upload(
        io.BytesIO(data), folder=folder, resource_type="image",
        transformation=[{"width": 1600, "height": 1600, "crop": "limit", "quality": "auto", "fetch_format": "auto"}],
    )
    return {"url": result["secure_url"], "public_id": result["public_id"]}


def delete_image(public_id):
    if public_id and cloudinary_enabled():
        _uploader().destroy(public_id, resource_type="image", invalidate=True)
