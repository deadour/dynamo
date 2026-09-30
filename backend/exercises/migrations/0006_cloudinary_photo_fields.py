from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("exercises", "0005_exercise_photo")]
    operations = [
        migrations.AddField(model_name="exercise", name="photo_public_id", field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name="exercise", name="photo_url", field=models.URLField(blank=True)),
    ]
