"""
Factory Boy factories for Django Auth service.
Used to generate test data for users and devices.
"""

import factory
from django.contrib.auth.models import User
from devices.models import Device


class UserFactory(factory.django.DjangoModelFactory):
    """Factory for creating test User instances."""
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
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


class AdminUserFactory(UserFactory):
    """Factory for creating test admin users."""
    is_staff = True
    is_superuser = True
    username = factory.Sequence(lambda n: f"admin{n}")


class DeviceFactory(factory.django.DjangoModelFactory):
    """Factory for creating test Device instances."""
    class Meta:
        model = Device

    device_id = factory.Sequence(lambda n: f"DEVICE{n:04d}")
    device_name = factory.Faker("word")
    ip_address = factory.Faker("ipv4")
    port = factory.LazyAttribute(lambda o: 4370)
    is_active = True
