from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        (
            "recruitment",
            "0015_desistementembauche",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="fichetransparence",
            name="processus",
            field=models.ForeignKey(
                on_delete=(
                    django.db.models.deletion.CASCADE
                ),
                related_name="fiches_transparence",
                to="recruitment.processusrecrutement",
            ),
        ),
    ]
