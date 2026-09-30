from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("exercises", "0002_initial")]

    operations = [migrations.AddField(model_name="exercise", name="name_es", field=models.CharField(blank=True, max_length=180))]
