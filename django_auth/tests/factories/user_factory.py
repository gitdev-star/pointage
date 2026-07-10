"""
Factory Boy factories for Django Auth service.
Used to generate test data for users and clockers/devices.

FIXED: previously imported django.contrib.auth.models.User (wrong —
this project's AUTH_USER_MODEL is accounts.User) and devices.models.Device
(doesn't exist — real models are Clocker / ClockerGroup). Both would
raise ImportError the moment this module was actually imported.
"""
import factory
from django.contrib.auth import get_user_model
from devices.models import Clocker, ClockerGroup

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    """Factory for creating test User instances (accounts.User)."""
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    role = "EMPLOYEE"
    is_active = True
    is_staff = False
    is_superuser = False

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        """Set password after user creation."""
        if not create:
            return
        if extracted:
            obj.set_password(extracted)
        else:
            obj.set_password("defaultpass123")
        obj.save()


class HRUserFactory(UserFactory):
    role = "HR"
    username = factory.Sequence(lambda n: f"hruser{n}")


class AdminUserFactory(UserFactory):
    """Factory for creating test admin users (role=ADMIN, not the same
    as Django is_superuser — this app's own RBAC is role-based)."""
    role = "ADMIN"
    is_staff = True
    is_superuser = True
    username = factory.Sequence(lambda n: f"admin{n}")


class ClockerGroupFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ClockerGroup
        django_get_or_create = ("name",)

    name = factory.Sequence(lambda n: f"Group{n}")
    description = factory.Faker("sentence")


class ClockerFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Clocker

    group = factory.SubFactory(ClockerGroupFactory)
    specific_name = factory.Faker("word")
    ip_address = factory.Sequence(lambda n: f"10.0.0.{n % 254 + 1}")
    port = 4370
    is_active = True