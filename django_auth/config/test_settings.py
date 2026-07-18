from config.settings import *

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

SECRET_KEY = "test-secret-key-not-for-production"
DEBUG = True
TESTING = True

# Disable all signals during tests
from django.db.models.signals import post_save, post_delete
post_save.disconnect()
post_delete.disconnect()