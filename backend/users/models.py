from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
import uuid
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        user = self.model(email=self.normalize_email(email), **extra); user.set_password(password); user.save(using=self._db); return user
    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True); return self.create_user(email, password, **extra)
class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True); name = models.CharField(max_length=120, blank=True); avatar_url = models.URLField(blank=True); avatar = models.BinaryField(null=True, blank=True, editable=False); avatar_type = models.CharField(max_length=20, blank=True); google_sub = models.CharField(max_length=255, blank=True, unique=True, null=True)
    is_active = models.BooleanField(default=True); is_staff = models.BooleanField(default=False); created_at = models.DateTimeField(auto_now_add=True); updated_at = models.DateTimeField(auto_now=True)
    objects = UserManager(); USERNAME_FIELD = "email"
