from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("users", "0002_user_avatar")]
    operations = [migrations.AddField(model_name="user", name="avatar_public_id", field=models.CharField(blank=True, max_length=255))]
