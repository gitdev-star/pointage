#!/bin/bash
# Run this from your pointage/ root directory
# Usage: bash create_django_hr.sh

set -e  # stop on any error

echo "🚀 Creating django_hr project structure..."

# ─── ROOT ─────────────────────────────────────────────────────────────────────
mkdir -p django_hr

# ─── CONFIG ───────────────────────────────────────────────────────────────────
mkdir -p django_hr/config
touch django_hr/config/__init__.py
touch django_hr/config/settings.py
touch django_hr/config/urls.py
touch django_hr/config/asgi.py
touch django_hr/config/wsgi.py

# ─── EMPLOYEES ────────────────────────────────────────────────────────────────
mkdir -p django_hr/employees/migrations
touch django_hr/employees/__init__.py
touch django_hr/employees/models.py
touch django_hr/employees/serializers.py
touch django_hr/employees/views.py
touch django_hr/employees/urls.py
touch django_hr/employees/admin.py
touch django_hr/employees/apps.py
touch django_hr/employees/migrations/__init__.py

# ─── LEAVES ───────────────────────────────────────────────────────────────────
mkdir -p django_hr/leaves/migrations
touch django_hr/leaves/__init__.py
touch django_hr/leaves/models.py
touch django_hr/leaves/serializers.py
touch django_hr/leaves/views.py
touch django_hr/leaves/urls.py
touch django_hr/leaves/admin.py
touch django_hr/leaves/apps.py
touch django_hr/leaves/migrations/__init__.py

# ─── EVENTS ───────────────────────────────────────────────────────────────────
mkdir -p django_hr/events/migrations
touch django_hr/events/__init__.py
touch django_hr/events/models.py
touch django_hr/events/serializers.py
touch django_hr/events/views.py
touch django_hr/events/urls.py
touch django_hr/events/admin.py
touch django_hr/events/apps.py
touch django_hr/events/migrations/__init__.py

# ─── PAYROLL ──────────────────────────────────────────────────────────────────
mkdir -p django_hr/payroll/migrations
touch django_hr/payroll/__init__.py
touch django_hr/payroll/models.py
touch django_hr/payroll/serializers.py
touch django_hr/payroll/views.py
touch django_hr/payroll/urls.py
touch django_hr/payroll/admin.py
touch django_hr/payroll/apps.py
touch django_hr/payroll/migrations/__init__.py

# ─── REPORTS ──────────────────────────────────────────────────────────────────
mkdir -p django_hr/reports/migrations
touch django_hr/reports/__init__.py
touch django_hr/reports/views.py
touch django_hr/reports/urls.py
touch django_hr/reports/apps.py
touch django_hr/reports/migrations/__init__.py

# ─── ROOT FILES ───────────────────────────────────────────────────────────────
touch django_hr/manage.py
touch django_hr/requirements.txt
touch django_hr/.env
touch django_hr/.env.example

echo ""
echo "✅ Structure created. Verifying..."
echo ""

find django_hr -type f | sort

echo ""
echo "─────────────────────────────────────────"
echo "📋 Next steps:"
echo ""
echo "1. Copy the generated files from Claude into each file:"
echo "   - django_hr/config/settings.py"
echo "   - django_hr/config/urls.py"
echo "   - django_hr/config/wsgi.py"
echo "   - django_hr/config/asgi.py"
echo "   - django_hr/manage.py"
echo "   - django_hr/requirements.txt"
echo "   - django_hr/employees/models.py  (and serializers, views, urls, admin)"
echo "   - django_hr/leaves/models.py     (and serializers, views, urls, admin)"
echo "   - django_hr/events/models.py     (and serializers, views, urls, admin)"
echo "   - django_hr/payroll/models.py    (and serializers, views, urls, admin)"
echo "   - django_hr/reports/views.py"
echo "   - django_hr/reports/urls.py"
echo ""
echo "2. Copy Dockerfile:"
echo "   cp path/to/django_hr.Dockerfile Dockerfiles/django_hr.Dockerfile"
echo ""
echo "3. Build and run:"
echo "   docker compose up --build django-hr -d"
echo "─────────────────────────────────────────"
