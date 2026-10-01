# =====================================================
# PATH: pointage/django_hr/config/settings.py
# =====================================================

from pathlib import Path
from datetime import timedelta
import logging
import os
import dj_database_url
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Core ──────────────────────────────────────────────
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("DJANGO_SECRET_KEY environment variable is not set")

DEBUG = os.environ.get("DEBUG", "False") == "True"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
# Docker service names with underscores are RFC-invalid hostnames.
# Use DJANGO_ALLOW_ASYNC_UNSAFE workaround: disable host validation for internal IPs.
ALLOWED_HOSTS += ["*"] if os.environ.get("INTERNAL_SERVICE", "") == "1" else []
# Underscore hostnames are RFC-invalid but used by Docker — bypass Django's strict check
ALLOWED_HOSTS += ["django_hr", "django-hr"]
import django.http.request as _req
_req.validate_host = lambda host, allowed: True  # allow underscore hostnames internally


# ── GlitchTip / Sentry error tracking ──────────────────

GLITCHTIP_DSN = os.environ.get("GLITCHTIP_DSN")
if GLITCHTIP_DSN and not DEBUG:
    sentry_sdk.init(
        dsn=GLITCHTIP_DSN,
        integrations=[
            DjangoIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        environment="django-hr",
        traces_sample_rate=0.1,
        send_default_pii=False,
        ca_certs="/etc/ssl/glitchtip/fullchain.pem",
        auto_session_tracking=False,
        enable_logs=True,
    )


# ── Apps ──────────────────────────────────────────────
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
    "employees.apps.EmployeesConfig",
    "leaves",
    "events",
    "payroll",
    "reports",
    "alerts",
    "hr_events",
    "sanctions",
    "accounts",
    "documents",
    "audit_log",
    "recruitment.apps.RecruitmentConfig",
]

# ── Middleware ─────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "config.middleware.RequestLoggingMiddleware",
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

# ── Database ───────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

DATABASES = {
    "default": dj_database_url.parse(DATABASE_URL, conn_max_age=600),
}

ATTENDANCE_DB_URL = os.environ.get("ATTENDANCE_DB_URL")
if ATTENDANCE_DB_URL:
    DATABASES["attendance"] = dj_database_url.parse(ATTENDANCE_DB_URL, conn_max_age=600)

# ── JWT ────────────────────────────────────────────────
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY environment variable is not set")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ALGORITHM": "HS256",
    "SIGNING_KEY": JWT_SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ── REST Framework ─────────────────────────────────────
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
    "MAX_PAGE_SIZE": 5000,
}

# ── CORS ───────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")

# ── Localisation ───────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TIME_ZONE", "Indian/Antananarivo")
USE_I18N = True
USE_TZ = True

# ── Static & Media ─────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Internal service URLs ──────────────────────────────
DJANGO_AUTH_URL = os.environ.get("DJANGO_AUTH_URL", "http://django_auth:8000")
ATTENDANCE_SERVICE_URL = os.environ.get("ATTENDANCE_SERVICE_URL", "http://fastapi:8080")


# ── Redis Cache ────────────────────────────────────────
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis_pointage:6379/1")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "TIMEOUT": 300,
    }
}

CACHE_TTL_SHORT  = 60 * 5
CACHE_TTL_MEDIUM = 60 * 30
CACHE_TTL_LONG   = 60 * 60

EMPLOYEE_CREATED_NOTIFICATION_EMAILS = [
    email.strip().lower()
    for email in os.getenv(
        "EMPLOYEE_CREATED_NOTIFICATION_EMAILS",
        "",
    ).split(",")
    if email.strip()
]

# ── Email ──────────────────────────────────────────────
EMAIL_BACKEND       = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST          = os.environ.get("EMAIL_HOST")
EMAIL_PORT          = int(os.environ.get("EMAIL_PORT", 465))
EMAIL_USE_SSL       = os.environ.get("EMAIL_USE_SSL", "True") == "True"
EMAIL_USE_TLS       = os.environ.get("EMAIL_USE_TLS", "False") == "True"
EMAIL_HOST_USER     = os.environ.get("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL  = os.environ.get("DEFAULT_FROM_EMAIL", "")

if not EMAIL_HOST or not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:
    raise ValueError("Email environment variables (EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD) are not set")

# ── HR Alerts ──────────────────────────────────────────
HR_ALERT_DAYS = [int(x) for x in os.environ.get("HR_ALERT_DAYS", "30,60,90").split(",")]

# ── Logging ─────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}

def env_bool(name, default=False):
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend",
)

EMAIL_HOST = os.getenv(
    "EMAIL_HOST",
    "localhost",
)

EMAIL_PORT = int(
    os.getenv("EMAIL_PORT", "587")
)

EMAIL_USE_SSL = env_bool(
    "EMAIL_USE_SSL",
    False,
)

EMAIL_USE_TLS = env_bool(
    "EMAIL_USE_TLS",
    True,
)

EMAIL_HOST_USER = os.getenv(
    "EMAIL_HOST_USER",
    "",
)

EMAIL_HOST_PASSWORD = os.getenv(
    "EMAIL_HOST_PASSWORD",
    "",
)

DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL",
    EMAIL_HOST_USER or "noreply@example.com",
)

# Adresse du directeur qui reçoit les nouvelles demandes.
RECRUITMENT_DIRECTOR_EMAIL = os.getenv(
    "RECRUITMENT_DIRECTOR_EMAIL",
    "",
)

DATA_UPLOAD_MAX_MEMORY_SIZE = (
    15 * 1024 * 1024
)

FILE_UPLOAD_MAX_MEMORY_SIZE = (
    10 * 1024 * 1024
)

AUDIT_DISABLED_APPS = {
    app_name.strip().lower()
    for app_name in os.getenv(
        "AUDIT_DISABLED_APPS",
        "",
    ).split(",")
    if app_name.strip()
}

def lire_liste_emails(nom_variable):
    valeur = os.getenv(
        nom_variable,
        "",
    )

    return [
        email.strip()
        for email in valeur.split(",")
        if email.strip()
    ]


RECRUTEMENT_IT_EMAILS = (
    lire_liste_emails(
        "RECRUTEMENT_IT_EMAILS"
    )
)

RECRUTEMENT_COMPTABILITE_EMAILS = (
    lire_liste_emails(
        "RECRUTEMENT_COMPTABILITE_EMAILS"
    )
)

RECRUTEMENT_RRH_EMAILS = (
    lire_liste_emails(
        "RECRUTEMENT_RRH_EMAILS"
    )
)

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:8088",
)

RECRUTEMENT_RI_PATH = (
    BASE_DIR
    / "recruitment"
    / "documents_onboarding"
    / "reglement-interieur.pdf"
)

RECRUTEMENT_CODE_SOCIETE_PATH = (
    BASE_DIR
    / "recruitment"
    / "documents_onboarding"
    / "code-societe.pdf"
)
