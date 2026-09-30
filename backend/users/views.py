import os
import time

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.http import HttpResponse
from django.urls import reverse
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.throttling import ScopedRateThrottle

from bodymetrics.views import ImageParser, detect_image_type

from .models import User

MAX_AVATAR_BYTES = 500_000


def signed_in(request, user, status=200):
    """Inicia la sesión y devuelve también un token: el front lo manda en el header Authorization,
    así funciona aunque el navegador bloquee cookies de terceros (Safari/iOS)."""
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    token, _ = Token.objects.get_or_create(user=user)
    return Response({**UserSerializer(user).data, "token": token.key}, status=status)
from .serializers import UserSerializer


class AuthViewSet(viewsets.ViewSet):
    throttle_scope = "auth"

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.action in ("login_user", "register", "google") else []

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def register(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        name = (request.data.get("name") or "").strip()[:120]
        try:
            validate_email(email)
        except ValidationError:
            return Response({"detail": "Ingresá un email válido."}, status=400)
        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "Ya existe una cuenta con ese email."}, status=400)
        user = User(email=email, name=name)
        try:
            validate_password(password, user)
        except ValidationError as exc:
            return Response({"detail": " ".join(exc.messages)}, status=400)
        user.set_password(password)
        user.save()
        return signed_in(request, user, status=201)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny], url_path="login")
    def login_user(self, request):
        user = authenticate(request, username=(request.data.get("email") or "").strip().lower(), password=request.data.get("password") or "")
        if user is None:
            return Response({"detail": "Email o contraseña incorrectos."}, status=400)
        return signed_in(request, user)
    @action(detail=False, methods=["get", "patch"])
    def me(self, request):
        if request.method == "PATCH":
            user = request.user
            if "email" in request.data and request.data["email"].strip().lower() != user.email:
                email = request.data["email"].strip().lower()
                if user.google_sub:
                    return Response({"detail": "El email de una cuenta de Google se administra desde Google."}, status=400)
                if not user.check_password(request.data.get("current_password") or ""):
                    return Response({"detail": "Para cambiar el email confirmá tu contraseña actual."}, status=400)
                try:
                    validate_email(email)
                except ValidationError:
                    return Response({"detail": "Ingresá un email válido."}, status=400)
                if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
                    return Response({"detail": "Ya existe una cuenta con ese email."}, status=400)
                user.email = email
                user.save(update_fields=["email", "updated_at"])
            serializer = UserSerializer(request.user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def dev_login(self, request):
        if os.getenv("DEBUG", "0") != "1":
            return Response({"detail": "disabled"}, status=404)
        user, _ = User.objects.get_or_create(
            email=request.data.get("email", "demo@dynamo.local"), defaults={"name": "Demo"}
        )
        return signed_in(request, user)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def google(self, request):
        credential = request.data.get("credential")
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not credential or not client_id:
            return Response({"detail": "Google OAuth no está configurado."}, status=400)
        try:
            claims = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
            if not claims.get("sub") or claims.get("email_verified") is not True:
                raise ValueError("invalid google token")
        except ValueError:
            return Response({"detail": "Credencial de Google inválida."}, status=status.HTTP_401_UNAUTHORIZED)
        user = User.objects.filter(google_sub=claims["sub"]).first()
        if user is None:
            user = User.objects.filter(email__iexact=claims["email"]).first()
            if user is not None:
                # Google verificó que el email es de esta persona: se vincula la cuenta y se invalida
                # cualquier contraseña previa, por si alguien se registró antes con un email ajeno.
                user.google_sub = claims["sub"]
                user.set_unusable_password()
            else:
                user = User(email=claims["email"], google_sub=claims["sub"])
                user.set_unusable_password()
        user.name = user.name or claims.get("name", "")
        user.avatar_url = user.avatar_url or claims.get("picture", "")
        # ADMIN_EMAILS solo aplica acá: Google garantiza que el email es de quien inicia sesión.
        if user.email.lower() in settings.ADMIN_EMAILS:
            user.is_staff = True
        user.save()
        return signed_in(request, user)

    @action(detail=False, methods=["post"])
    def password(self, request):
        user = request.user
        if user.has_usable_password() and not user.check_password(request.data.get("current_password") or ""):
            return Response({"detail": "La contraseña actual no es correcta."}, status=400)
        new_password = request.data.get("new_password") or ""
        try:
            validate_password(new_password, user)
        except ValidationError as exc:
            return Response({"detail": " ".join(exc.messages)}, status=400)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        # Cambiar la contraseña cierra las otras sesiones: token nuevo para este dispositivo.
        Token.objects.filter(user=user).delete()
        update_session_auth_hash(request, user)
        return signed_in(request, user)

    @action(detail=False, methods=["put", "delete"], parser_classes=[ImageParser])
    def avatar(self, request):
        user = request.user
        if request.method == "DELETE":
            user.avatar, user.avatar_type, user.avatar_url = None, "", ""
            user.save(update_fields=["avatar", "avatar_type", "avatar_url", "updated_at"])
            return Response(UserSerializer(user).data)
        data = request.data if isinstance(request.data, bytes) else b""
        content_type = detect_image_type(data)
        if content_type is None or len(data) > MAX_AVATAR_BYTES:
            return Response({"detail": "Subí una imagen JPG, PNG o WebP de hasta 500 KB."}, status=400)
        user.avatar, user.avatar_type = data, content_type
        user.avatar_url = request.build_absolute_uri(reverse("user-avatar", args=[user.id])) + f"?v={int(time.time())}"
        user.save(update_fields=["avatar", "avatar_type", "avatar_url", "updated_at"])
        return Response(UserSerializer(user).data)

    @action(detail=False, methods=["post"], url_path="logout")
    def logout_user(self, request):
        if request.user.is_authenticated:
            Token.objects.filter(user=request.user).delete()
        logout(request)
        return Response(status=204)


@api_view(["GET"])
@permission_classes([AllowAny])
def avatar_image(request, user_id):
    user = User.objects.filter(pk=user_id).only("avatar", "avatar_type").first()
    if user is None or not user.avatar_type:
        return HttpResponse(status=404)
    response = HttpResponse(bytes(user.avatar), content_type=user.avatar_type)
    response["Cache-Control"] = "public, max-age=604800"
    return response
