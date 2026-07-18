import datetime
import decimal
from django.forms.models import model_to_dict
from .models import AuditLog


def get_client_ip(request):
    if not request:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _serialize_value(v):
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    if hasattr(v, "pk"):
        return v.pk
    return v


def snapshot(instance, exclude=("photo",)):
    data = model_to_dict(instance)
    for f in exclude:
        data.pop(f, None)
    return {k: _serialize_value(v) for k, v in data.items()}


def diff_dict(old: dict, new: dict) -> dict:
    changes = {}
    for key in new:
        if key == "id":
            continue
        old_v, new_v = _serialize_value(old.get(key)), _serialize_value(new.get(key))
        if old_v != new_v:
            changes[key] = {"old": old_v, "new": new_v}
    return changes


def log_action(request, instance, action, changes=None):
    user = getattr(request, "user", None)
    user_id = getattr(user, "id", None) if user else None
    username = getattr(user, "username", "") if user else ""
    role = getattr(user, "role", "") if user else ""

    AuditLog.objects.create(
        user_id=user_id,
        username=username,
        role=role,
        action=action,
        app_label=instance._meta.app_label,
        model_name=instance._meta.model_name,
        object_id=str(instance.pk),
        object_repr=str(instance)[:255],
        changes=changes or {},
        ip_address=get_client_ip(request),
    )