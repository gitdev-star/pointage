# django_hr/alerts/management/commands/check_device_status.py
# Notify HR users (bell) when a clocker becomes unreachable, and when it answers again.
# Uses the same ping as the devices page (/devices/status).
import os
import time
from datetime import timedelta

import requests
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accounts.models import HRProfile
from alerts.models import DeviceAlertState, InAppNotification

ATTENDANCE_SERVICE_URL = os.environ.get("ATTENDANCE_SERVICE_URL", "http://fastapi:8080")
REMIND_HOURS = float(os.environ.get("DEVICE_ALERT_REMIND_HOURS", "4"))   # repeat reminder while still down
GROUP_AT = int(os.environ.get("DEVICE_ALERT_GROUP_AT", "3"))             # this many at once -> one grouped notification
RECHECK_SECONDS = int(os.environ.get("DEVICE_ALERT_RECHECK_SECONDS", "20"))


def _dur(delta):
    minutes = max(0, int(delta.total_seconds() // 60))
    return f"{minutes} min" if minutes < 60 else f"{minutes // 60} h {minutes % 60:02d} min"


def _fetch():
    resp = requests.get(f"{ATTENDANCE_SERVICE_URL}/devices/status", timeout=60)
    resp.raise_for_status()
    down, up = {}, {}
    for d in resp.json()["devices"]:
        ip = d.get("ip_address")
        if not ip or not d.get("is_active", True):
            continue
        (up if d.get("reachable") else down)[ip] = d.get("name") or ip
    return down, up


def _names(states):
    names = sorted(s.name or s.ip_address for s in states)
    return ", ".join(names[:10]) + (" …" if len(names) > 10 else "")


class Command(BaseCommand):
    help = "Notify HR users in the bell when a clocker is unreachable or reachable again."

    def handle(self, *args, **options):
        try:
            down, up = _fetch()
            if down:                                   # confirm once before alerting
                time.sleep(RECHECK_SECONDS)
                down2, _ = _fetch()
                up.update({ip: n for ip, n in down.items() if ip not in down2})   # answered the second time
                down = {ip: n for ip, n in down.items() if ip in down2}
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"devices/status failed, nothing changed: {exc}"))
            return

        recipients = list(
            HRProfile.objects.filter(is_active=True)
            .filter(Q(perm_devices_read=True) | Q(is_director=True))
            .values_list("auth_user_id", flat=True)
        )
        if not recipients:
            self.stdout.write(self.style.WARNING("No recipient (perm_devices_read or director): nothing sent."))
            return

        now = timezone.now()
        remind = timedelta(hours=REMIND_HOURS)
        went_down, still_down, came_back = [], [], []

        with transaction.atomic():
            for ip, name in down.items():
                st, created = DeviceAlertState.objects.get_or_create(
                    ip_address=ip, defaults={"name": name, "reachable": False, "since": now})
                if created:
                    # first time we see this device: if it was already reported recently, adopt that moment
                    prev = (InAppNotification.objects
                            .filter(category="system", title=f"Pointeuse injoignable : {name}",
                                    created_at__gte=now - remind)
                            .order_by("created_at").first())
                    if prev:
                        st.since = st.last_notified_at = prev.created_at
                elif st.reachable:
                    st.reachable, st.since, st.last_notified_at = False, now, None
                st.name = name
                if st.last_notified_at is None:
                    went_down.append(st)
                elif now - st.last_notified_at >= remind:
                    still_down.append(st)
                st.save()

            for st in DeviceAlertState.objects.filter(ip_address__in=list(up), reachable=False):
                came_back.append((st, now - st.since))

            items = []
            to_report = went_down + still_down
            if len(to_report) >= GROUP_AT:
                items.append(("error", "Plusieurs pointeuses injoignables",
                              f"{len(to_report)} appareils ne répondent plus : {_names(to_report)}. "
                              "Les pointages de ces appareils peuvent être incomplets."))
            else:
                for st in went_down:
                    items.append(("error", f"Pointeuse injoignable : {st.name}",
                                  f"{st.name} ({st.ip_address}) ne répond plus. "
                                  "Les pointages de cet appareil peuvent être incomplets tant qu'il est hors ligne."))
                for st in still_down:
                    items.append(("error", f"Pointeuse toujours injoignable : {st.name}",
                                  f"{st.name} ({st.ip_address}) est injoignable depuis {_dur(now - st.since)}."))
            if len(came_back) >= GROUP_AT:
                items.append(("success", "Plusieurs pointeuses de nouveau en ligne",
                              f"{len(came_back)} appareils répondent de nouveau : {_names([s for s, _ in came_back])}."))
            else:
                for st, dur in came_back:
                    items.append(("success", f"Pointeuse de nouveau en ligne : {st.name}",
                                  f"{st.name} ({st.ip_address}) répond de nouveau après {_dur(dur)} d'interruption."))

            InAppNotification.objects.bulk_create([
                InAppNotification(auth_user_id=uid, title=title[:200], message=msg, level=level, category="system")
                for level, title, msg in items for uid in recipients
            ])
            for st in to_report:
                st.last_notified_at = now
                st.save()
            for st, _ in came_back:
                st.reachable, st.since, st.last_notified_at = True, now, None
                st.save()

        self.stdout.write(f"{len(down)} unreachable, {len(came_back)} back online, "
                          f"{len(items)} notification(s) x {len(recipients)} user(s).")
