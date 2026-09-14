# from rest_framework import serializers
# from .models import HRProfile


# class HRProfileSerializer(serializers.ModelSerializer):
#     all_permissions = serializers.DictField(read_only=True)
#     visible_modules = serializers.ListField(read_only=True)
#     factory_name    = serializers.CharField(source="factory.name",    read_only=True)
#     department_name = serializers.CharField(source="department.name", read_only=True)

#     class Meta:
#         model  = HRProfile
#         fields = "__all__"

from rest_framework import serializers

from employees.models import Employee

from .models import HRProfile

from django.db import transaction


class HRProfileSerializer(
    serializers.ModelSerializer
):
    all_permissions = serializers.DictField(
        read_only=True
    )

    visible_modules = serializers.ListField(
        read_only=True
    )

    factory_name = serializers.CharField(
        source="factory.name",
        read_only=True,
        default="",
    )

    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
        default="",
    )

    matricule = serializers.SerializerMethodField()

    nom_complet = (
        serializers.SerializerMethodField()
    )

    poste_nom = (
        serializers.SerializerMethodField()
    )

    departement_employe_nom = (
        serializers.SerializerMethodField()
    )

    factory_employe_nom = (
        serializers.SerializerMethodField()
    )

    def validate(self, attrs):
        responsable = attrs.get(
            "is_recruitment_responsible",
            getattr(
                self.instance,
                "is_recruitment_responsible",
                False,
            ),
        )

        email = attrs.get(
            "email",
            getattr(
                self.instance,
                "email",
                "",
            ),
        )

        is_active = attrs.get(
            "is_active",
            getattr(
                self.instance,
                "is_active",
                True,
            ),
        )

        is_director = attrs.get(
            "is_director",
            getattr(
                self.instance,
                "is_director",
                False,
            ),
        )

        if responsable and not str(email).strip():
            raise serializers.ValidationError(
                {
                    "is_recruitment_responsible": (
                        "Le responsable du recrutement "
                        "doit avoir une adresse e-mail."
                    )
                }
            )

        if responsable and not is_active:
            raise serializers.ValidationError(
                {
                    "is_recruitment_responsible": (
                        "Le responsable du recrutement "
                        "doit avoir un profil actif."
                    )
                }
            )

        if responsable and is_director:
            raise serializers.ValidationError(
                {
                    "is_recruitment_responsible": (
                        "Le directeur ne peut pas être désigné "
                        "comme responsable du recrutement."
                    )
                }
            )

        return attrs


    @transaction.atomic
    def create(self, validated_data):
        nouveau_responsable = validated_data.get(
            "is_recruitment_responsible",
            False,
        )

        if nouveau_responsable:
            HRProfile.objects.filter(
                is_recruitment_responsible=True,
            ).update(
                is_recruitment_responsible=False,
            )

        return super().create(validated_data)


    @transaction.atomic
    def update(self, instance, validated_data):
        nouveau_responsable = validated_data.get(
            "is_recruitment_responsible",
            instance.is_recruitment_responsible,
        )

        if nouveau_responsable:
            HRProfile.objects.filter(
                is_recruitment_responsible=True,
            ).exclude(
                pk=instance.pk,
            ).update(
                is_recruitment_responsible=False,
            )

        return super().update(
            instance,
            validated_data,
        )

    class Meta:
        model = HRProfile
        fields = "__all__"

    def obtenir_employe(
        self,
        profil,
    ):
        if hasattr(
            profil,
            "_employe_connecte_cache",
        ):
            return (
                profil
                ._employe_connecte_cache
            )

        employes = (
            Employee.objects
            .select_related(
                "factory",
                "department",
                "job_title",
            )
            .filter(
                status=Employee.Status.ACTIVE,
            )
        )

        # Première recherche :
        # identifiant du compte d’authentification.
        employe = (
            employes
            .filter(
                auth_user_id=(
                    profil.auth_user_id
                )
            )
            .first()
        )

        # Deuxième recherche :
        # adresse e-mail AD.
        if (
            not employe
            and profil.email
        ):
            employe = (
                employes
                .filter(
                    email__iexact=(
                        profil.email.strip()
                    )
                )
                .first()
            )

        # Si username contient directement
        # l’adresse e-mail AD.
        if (
            not employe
            and profil.username
            and "@" in profil.username
        ):
            employe = (
                employes
                .filter(
                    email__iexact=(
                        profil.username.strip()
                    )
                )
                .first()
            )

        # Si username contient seulement
        # la partie située avant le @.
        if (
            not employe
            and profil.username
            and "@" not in profil.username
        ):
            debut_email = (
                f"{profil.username.strip()}@"
            )

            correspondances = (
                employes
                .filter(
                    email__istartswith=(
                        debut_email
                    )
                )
            )

            # On utilise cette correspondance
            # seulement si elle est unique.
            if correspondances.count() == 1:
                employe = (
                    correspondances.first()
                )

        profil._employe_connecte_cache = (
            employe
        )

        return employe

    def get_matricule(
        self,
        profil,
    ):
        employe = self.obtenir_employe(
            profil
        )

        if not employe:
            return ""

        return employe.employee_id

    def get_nom_complet(
        self,
        profil,
    ):
        employe = self.obtenir_employe(
            profil
        )

        if not employe:
            return profil.username

        nom_complet = " ".join(
            valeur.strip()
            for valeur in [
                employe.first_name or "",
                employe.last_name or "",
            ]
            if valeur and valeur.strip()
        )

        return (
            nom_complet
            or profil.username
        )

    def get_poste_nom(
        self,
        profil,
    ):
        employe = self.obtenir_employe(
            profil
        )

        if (
            employe
            and employe.job_title
        ):
            return employe.job_title.name

        return profil.job_title or ""

    def get_departement_employe_nom(
        self,
        profil,
    ):
        employe = self.obtenir_employe(
            profil
        )

        if (
            employe
            and employe.department
        ):
            return employe.department.name

        if profil.department:
            return profil.department.name

        return ""

    def get_factory_employe_nom(
        self,
        profil,
    ):
        employe = self.obtenir_employe(
            profil
        )

        if (
            employe
            and employe.factory
        ):
            return employe.factory.name

        if profil.factory:
            return profil.factory.name

        return ""