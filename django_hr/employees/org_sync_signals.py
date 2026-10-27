"""When HR saves/deletes a factory, department or section, tell the
maintenance app to resynchronise its org_units. Never blocks or breaks the
HR save: the call runs after the DB commit, in a thread, with a short timeout.
The daily sync on the maintenance side stays as the safety net."""
import logging
import os
import threading
import urllib.request

from django.db import transaction
from django.db.models.signals import post_delete, post_save

log = logging.getLogger(__name__)

URL = os.environ.get("MAINTENANCE_ORG_SYNC_URL", "")
SECRET = os.environ.get("MAINTENANCE_ORG_SYNC_SECRET", "")


def _post():
    try:
        req = urllib.request.Request(
            URL, data=b"{}", method="POST",
            headers={"X-Org-Sync-Secret": SECRET, "Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5).read()
    except Exception as e:
        log.warning("maintenance org sync call failed: %s", e)


def notify_maintenance(**kwargs):
    if kwargs.get("raw") or not URL or not SECRET:
        return
    transaction.on_commit(lambda: threading.Thread(target=_post, daemon=True).start())


for _model in ("employees.Factory", "employees.Department", "employees.Section"):
    post_save.connect(notify_maintenance, sender=_model, weak=False,
                      dispatch_uid="org_sync_save_" + _model)
    post_delete.connect(notify_maintenance, sender=_model, weak=False,
                        dispatch_uid="org_sync_delete_" + _model)
