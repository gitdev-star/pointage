"""
tests/unit/test_router_registration.py

QE finding: nothing currently confirms that every module in app/routers/
is actually wired into main.py's FastAPI app. A new router added but
never `app.include_router(...)`-ed would ship silently -- no test fails,
no error, the endpoints just don't exist.

This test inspects the live app's registered routes and cross-checks
against the router modules that exist on disk.
"""
import importlib
import pkgutil

import app.routers as routers_pkg
from main import app


def _router_modules_on_disk():
    """Every non-private .py module inside app/routers/."""
    names = []
    for _, modname, ispkg in pkgutil.iter_modules(routers_pkg.__path__):
        if not ispkg and not modname.startswith("_"):
            names.append(modname)
    return names


def _mounted_route_prefixes():
    return {route.path for route in app.routes}


def test_every_router_module_defines_a_router_object():
    """Sanity check the assumption the next test relies on -- every
    router module should expose a `router` (APIRouter) attribute."""
    for modname in _router_modules_on_disk():
        module = importlib.import_module(f"app.routers.{modname}")
        assert hasattr(module, "router"), (
            f"app/routers/{modname}.py has no `router` attribute -- "
            "either rename it or confirm it's intentionally not a route module."
        )


def test_every_router_on_disk_is_mounted_in_main_app():
    """Cross-check: every router module's own route paths should appear
    somewhere in the live app's registered routes. Catches a router that
    was written but never app.include_router()-ed in main.py."""
    mounted_paths = _mounted_route_prefixes()

    for modname in _router_modules_on_disk():
        module = importlib.import_module(f"app.routers.{modname}")
        router = getattr(module, "router", None)
        if router is None:
            continue  # already flagged by the previous test

        router_paths = {r.path for r in router.routes}
        # At least one of this router's own paths must show up mounted
        # in the live app -- if none do, it was never included.
        overlap = router_paths & mounted_paths
        assert overlap or not router_paths, (
            f"app/routers/{modname}.py defines routes {sorted(router_paths)} "
            f"but none of them appear in the live app's mounted routes. "
            f"Check that main.py calls app.include_router(...) for this module."
        )