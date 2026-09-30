from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("bodymetrics", "0003_body_weight_photo")]

    operations = [
        migrations.AddField(model_name="bodyweight", name="photo_url", field=models.URLField(blank=True)),
        migrations.AddField(model_name="bodyweight", name="photo_public_id", field=models.CharField(blank=True, max_length=255)),
    ]
