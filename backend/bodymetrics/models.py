import uuid
from django.conf import settings
from django.db import models
class BodyWeight(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name="body_weights"); date=models.DateField(); weight_kg=models.DecimalField(max_digits=5,decimal_places=2); notes=models.TextField(blank=True); photo=models.BinaryField(null=True,blank=True,editable=False); photo_type=models.CharField(max_length=20,blank=True); created_at=models.DateTimeField(auto_now_add=True)
    class Meta: unique_together=[("user","date")]; ordering=["-date"]; indexes=[models.Index(fields=["user","date"])]
