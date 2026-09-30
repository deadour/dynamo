import os

from django.contrib.auth import login, logout
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import User
from .serializers import UserSerializer


class AuthViewSet(viewsets.ViewSet):
    @action(detail=False, methods=["get", "patch"])
    def me(self, request):
        if request.method == "PATCH":
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
        login(request, user)
        return Response(UserSerializer(user).data)

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
        user, _ = User.objects.update_or_create(
            google_sub=claims["sub"],
            defaults={"email": claims["email"], "name": claims.get("name", ""), "avatar_url": claims.get("picture", "")},
        )
        login(request, user)
        return Response(UserSerializer(user).data)

    @action(detail=False, methods=["post"], url_path="logout")
    def logout_user(self, request):
        logout(request)
        return Response(status=204)
