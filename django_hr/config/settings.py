# =====================================================
# PATH: pointage/django_hr/config/settings.py
# =====================================================

from pathlib import Path
from datetime import timedelta
import os
import dj_database_url
import ssl

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "change-me-in-production")
DEBUG = os.environ.get("DEBUG", "True") == "True"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

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
   # "employees",
    "employees.apps.EmployeesConfig",  # ✅ FIX
    "leaves",
    "events",
    "payroll",
    "reports",
    "alerts",
    "hr_events",
    "sanctions",
    "accounts",
    "documents",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "accounts.middleware.HRJWTMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.config(
        env="DATABASE_URL",
        default="postgresql://user:pass@localhost:5432/hr_db",
        conn_max_age=600,
    ),
    "attendance": dj_database_url.config(
        env="ATTENDANCE_DB_URL",
        default="postgresql://user:pass@localhost:5432/attendance",
        conn_max_age=600,
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ALGORITHM": "HS256",
    "SIGNING_KEY": os.environ.get("JWT_SECRET_KEY", SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.ServiceAuthentication",
        "accounts.authentication.HRTokenAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "config.pagination.FlexiblePagination",
    "PAGE_SIZE": 20,
}


CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TIME_ZONE", "Indian/Antananarivo")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

DJANGO_AUTH_URL = os.environ.get("DJANGO_AUTH_URL", "http://django_auth:8000")

# ── Redis Cache ───────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://redis_pointage:6379/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "TIMEOUT": 300,  # 5 minutes
    }
}

# ── Cache timeouts ────────────────────────────────────
CACHE_TTL_SHORT  = 60 * 5    # 5 minutes
CACHE_TTL_MEDIUM = 60 * 30   # 30 minutes
CACHE_TTL_LONG   = 60 * 60   # 1 hour

# ── Email Configuration ───────────────────────────────

# ── Email ─────────────────────────────────────────────
EMAIL_BACKEND       = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST          = "smtpauth.moov.mg"
EMAIL_PORT          = 465
EMAIL_USE_SSL       = True
EMAIL_USE_TLS       = False
EMAIL_HOST_USER     = "noreply@pb-industries.mg"
EMAIL_HOST_PASSWORD = "XFphaGzDKbzCTj7"
DEFAULT_FROM_EMAIL  = "Système RH <noreply@pb-industries.mg>"
HR_ALERT_DAYS       = [int(x) for x in os.environ.get("HR_ALERT_DAYS", "30,60,90").split(",")]
