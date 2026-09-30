from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import BaseParser
from rest_framework.response import Response
from .models import BodyWeight
from .serializers import BodyWeightSerializer
from media_utils import delete_image, upload_image

MAX_PHOTO_BYTES = 1_500_000
SIGNATURES = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG\r\n\x1a\n": "image/png"}


def detect_image_type(data):
    for signature, content_type in SIGNATURES.items():
        if data.startswith(signature):
            return content_type
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class ImageParser(BaseParser):
    media_type = "image/*"
    def parse(self, stream, media_type=None, parser_context=None): return stream.read(MAX_PHOTO_BYTES + 1)


class BodyWeightViewSet(viewsets.ModelViewSet):
    serializer_class=BodyWeightSerializer
    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return BodyWeight.objects.none()
        qs = BodyWeight.objects.filter(user=self.request.user)
        return qs if self.action == "photo" else qs.defer("photo")
    def perform_create(self,serializer): serializer.save(user=self.request.user)

    @action(detail=True, methods=["get", "put", "delete"], parser_classes=[ImageParser])
    def photo(self, request, pk=None):
        entry = self.get_object()
        if request.method == "GET":
            if entry.photo_url:
                return Response({"url": entry.photo_url})
            if not entry.photo_type:
                return Response({"detail": "Este registro no tiene foto."}, status=status.HTTP_404_NOT_FOUND)
            response = HttpResponse(bytes(entry.photo), content_type=entry.photo_type)
            response["Cache-Control"] = "private, max-age=86400"
            return response
        if request.method == "DELETE":
            delete_image(entry.photo_public_id)
            entry.photo, entry.photo_type, entry.photo_url, entry.photo_public_id = None, "", "", ""
            entry.save(update_fields=["photo", "photo_type", "photo_url", "photo_public_id"])
            return Response(status=status.HTTP_204_NO_CONTENT)
        data = request.data if isinstance(request.data, bytes) else b""
        if len(data) > MAX_PHOTO_BYTES:
            return Response({"detail": "La foto es demasiado grande (máx. 1,5 MB)."}, status=status.HTTP_400_BAD_REQUEST)
        content_type = detect_image_type(data)
        if content_type is None:
            return Response({"detail": "Formato no soportado. Usá JPG, PNG o WebP."}, status=status.HTTP_400_BAD_REQUEST)
        uploaded = upload_image(data, "dynamo/progress")
        if uploaded:
            delete_image(entry.photo_public_id)
            entry.photo, entry.photo_type = None, ""
            entry.photo_url, entry.photo_public_id = uploaded["url"], uploaded["public_id"]
            entry.save(update_fields=["photo", "photo_type", "photo_url", "photo_public_id"])
            return Response(BodyWeightSerializer(entry).data)
        entry.photo, entry.photo_type = data, content_type
        entry.save(update_fields=["photo", "photo_type"])
        return Response(BodyWeightSerializer(entry).data)
