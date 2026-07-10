# config/test_settings.py
# Overrides for testing.
#
# DATABASES now reads the real DATABASE_URL when it's set (CI's
# ephemeral postgres:15 service container, or a real Postgres instance
# for local runs) so tests exercise actual Postgres FK/type/constraint
# behavior instead of SQLite's more permissive dialect -- this is what
# catches real migration/FK bugs (e.g. the Classification id_classification
# rename, missing TransportList/TransportListItem migrations) before
# they hit production. Falls back to in-memory SQLite only when
# DATABASE_URL is genuinely unset. CI's ci.yml already sets DATABASE_URL
# for the django_hr test step, so CI always uses real Postgres.

SECRET_KEY = "test-secret-key-not-for-production-django-hr"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "employees",
    "accounts",
    "payroll",
    "leaves",
    "reports",
    "documents",
    "sanctions",
    "alerts",
    "events",
    "hr_events",
    "testsupport",
]

import dj_database_url

DATABASES = {
    "default": dj_database_url.config(
        env="DATABASE_URL",
        default="sqlite:///:memory:",
        conn_max_age=0,
    )
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Minimal middleware
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = "/tmp/test_media/"
