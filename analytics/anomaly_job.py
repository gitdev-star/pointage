#!/usr/bin/env python3
"""Rule-based anomaly detection for the attendance DB. Writes into `insights`."""
import argparse
import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg2
from psycopg2.extras import Json, RealDictCursor

TZ = ZoneInfo("Indian/Antananarivo")

# Thresholds: tune them after looking at a few weeks of results
GLOBAL_DROP_WARN, GLOBAL_DROP_CRIT = 0.5, 0.2
DEVICE_DROP_WARN, DEVICE_DROP_CRIT = 0.4, 0.1
DOUBLE_RATIO_WARN, DOUBLE_MIN = 0.15, 30
ODD_RATIO_WARN, ODD_RATIO_CRIT = 0.25, 0.40
INCOMPLETE_MIN_USERS = 200  # ignore Sundays / tiny samples
DRIFT_MINUTES = 30
SITE_DROP_WARN, SITE_DROP_CRIT = 0.7, 0.4
NET_SQL = "left(device_ip, length(device_ip) - length(split_part(device_ip, '.', 4)) - 1)"

# Same weekday over the previous 4 weeks = baseline
SAME_WEEKDAYS = "(%(d)s::date - 7, %(d)s::date - 14, %(d)s::date - 21, %(d)s::date - 28)"


def mk(d, rule, severity, scope_type, scope_value, title, message, payload, kind="anomaly"):
    return dict(d=d, kind=kind, rule=rule, severity=severity, scope_type=scope_type,
                scope_value=scope_value, title=title, message=message, payload=payload)


def rule_global_volume(cur, d):
    cur.execute(f"""
        WITH base AS (SELECT date, count(*) AS n FROM attendance
                      WHERE date IN {SAME_WEEKDAYS} GROUP BY date)
        SELECT (SELECT count(*) FROM attendance WHERE date = %(d)s) AS today,
               (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY n) FROM base) AS med,
               (SELECT count(*) FROM base) AS weeks
    """, {"d": d})
    r = cur.fetchone()
    today, med, weeks = r["today"], float(r["med"] or 0), r["weeks"]
    if weeks < 2 or med < 500:
        return [], False
    ratio = today / med
    if ratio >= GLOBAL_DROP_WARN:
        return [], False
    sev = "critical" if ratio < GLOBAL_DROP_CRIT else "warning"
    msg = (f"{today} pointages le {d}, contre environ {med:.0f} habituellement pour ce jour de la "
           f"semaine ({ratio:.0%}). Causes possibles : panne réseau ou du service de synchronisation, "
           f"jour férié, congés collectifs.")
    return [mk(d, "global_volume_drop", sev, "global", "", "Baisse globale du volume de pointages",
               msg, {"today": today, "baseline_median": med, "ratio": round(ratio, 3)})], True


def rule_device_volume(cur, d):
    cur.execute(f"""
        WITH active_days AS (SELECT date AS day FROM attendance
                             WHERE date IN {SAME_WEEKDAYS} GROUP BY date),
        counts AS (SELECT device_ip, date, count(*) AS n FROM attendance
                   WHERE date IN {SAME_WEEKDAYS} GROUP BY device_ip, date),
        base AS (SELECT dv.device_ip, coalesce(c.n, 0) AS n
                 FROM (SELECT DISTINCT device_ip FROM counts) dv
                 CROSS JOIN active_days ad
                 LEFT JOIN counts c ON c.device_ip = dv.device_ip AND c.date = ad.day),
        baseline AS (SELECT device_ip, percentile_cont(0.5) WITHIN GROUP (ORDER BY n) AS med,
                            count(*) AS weeks FROM base GROUP BY device_ip),
        today AS (SELECT device_ip, count(*) AS n FROM attendance WHERE date = %(d)s GROUP BY device_ip)
        SELECT b.device_ip, b.med, coalesce(t.n, 0) AS n
        FROM baseline b LEFT JOIN today t USING (device_ip)
        WHERE b.weeks >= 2 AND b.med >= 50
    """, {"d": d})
    out = []
    for r in cur.fetchall():
        med, n = float(r["med"]), r["n"]
        ratio = n / med
        if ratio >= DEVICE_DROP_WARN:
            continue
        sev = "critical" if ratio < DEVICE_DROP_CRIT else "warning"
        msg = (f"La pointeuse {r['device_ip']} a enregistré {n} pointages le {d}, contre environ "
               f"{med:.0f} habituellement ({ratio:.0%}). Vérifier l'alimentation, le réseau et la synchronisation.")
        out.append(mk(d, "device_volume_drop", sev, "device", r["device_ip"],
                      f"Pointeuse {r['device_ip']} : baisse d'activité", msg,
                      {"today": n, "baseline_median": med, "ratio": round(ratio, 3)}))
    return group_by_site(d, out)


def rule_site_volume(cur, d):
    cur.execute(f"""
        WITH active_days AS (SELECT date AS day FROM attendance
                             WHERE date IN {SAME_WEEKDAYS} GROUP BY date),
        counts AS (SELECT {NET_SQL} AS net, date, count(*) AS n FROM attendance
                   WHERE date IN {SAME_WEEKDAYS} GROUP BY 1, 2),
        base AS (SELECT nt.net, coalesce(c.n, 0) AS n
                 FROM (SELECT DISTINCT net FROM counts) nt
                 CROSS JOIN active_days ad
                 LEFT JOIN counts c ON c.net = nt.net AND c.date = ad.day),
        baseline AS (SELECT net, percentile_cont(0.5) WITHIN GROUP (ORDER BY n) AS med,
                            count(*) AS weeks FROM base GROUP BY net),
        today AS (SELECT {NET_SQL} AS net, count(*) AS n FROM attendance
                  WHERE date = %(d)s GROUP BY 1)
        SELECT b.net, b.med, coalesce(t.n, 0) AS n
        FROM baseline b LEFT JOIN today t USING (net)
        WHERE b.weeks >= 2 AND b.med >= 300
    """, {"d": d})
    out = []
    for r in cur.fetchall():
        med, n = float(r["med"]), r["n"]
        ratio = n / med
        if ratio >= SITE_DROP_WARN:
            continue
        sev = "critical" if ratio < SITE_DROP_CRIT else "warning"
        out.append(mk(d, "site_volume_drop", sev, "site", r["net"] + ".0/24",
                      f"Réseau {r['net']}.x : activité en baisse",
                      f"Le réseau {r['net']}.0/24 a enregistré {n} pointages le {d}, contre environ {med:.0f} "
                      f"habituellement ({ratio:.0%}). Plusieurs pointeuses du même site semblent touchées "
                      f"(synchronisation, réseau ou électricité).",
                      {"today": n, "baseline_median": med, "ratio": round(ratio, 3)}))
    return out


def tidy(d, alerts):
    """Drop device alerts covered by a site alert; demote near-zero Saturday drops to info."""
    site_nets = {a["scope_value"].rsplit(".", 1)[0] for a in alerts if a["rule"] == "site_volume_drop"}
    out = [a for a in alerts
           if not (a["rule"] == "device_volume_drop" and a["scope_value"].rsplit(".", 1)[0] in site_nets)]
    if d.weekday() == 5:  # Saturday: work is optional per site
        for a in out:
            if a["rule"] in ("site_volume_drop", "device_volume_drop"):
                p = a["payload"]
                r = p["ratio"] if "ratio" in p else max(p["ratios"].values())
                if r < 0.15:
                    a["severity"] = "info"
                    a["message"] += " Samedi : activité quasi nulle, le site n'était probablement pas planifié."
    return out


def group_by_site(d, alerts, min_devices=3):
    """Merge device alerts sharing a /24 network into one site-level alert."""
    by_net = {}
    for a in alerts:
        by_net.setdefault(a["scope_value"].rsplit(".", 1)[0], []).append(a)
    out = []
    for net, items in by_net.items():
        if len(items) < min_devices:
            out += items
            continue
        sev = "critical" if any(i["severity"] == "critical" for i in items) else "warning"
        ips = sorted(i["scope_value"] for i in items)
        out.append(mk(d, "site_volume_drop", sev, "site", net + ".0/24",
                      f"Réseau {net}.x : {len(items)} pointeuses en baisse",
                      f"{len(items)} pointeuses du réseau {net}.0/24 ont une activité anormalement basse le {d} "
                      f"({', '.join(ips)}). Cause probable commune : site non travaillé ce jour, "
                      f"panne réseau ou électrique.",
                      {"devices": ips,
                       "ratios": {i["scope_value"]: i["payload"]["ratio"] for i in items}}))
    return out


def rule_double_punches(cur, d):
    cur.execute("""
        SELECT device_ip, count(*) FILTER (WHERE gap < interval '2 minutes') AS doubles, count(*) AS n
        FROM (SELECT device_ip, date,
                     device_timestamp - lag(device_timestamp) OVER (PARTITION BY user_id ORDER BY device_timestamp) AS gap
              FROM attendance
              WHERE date BETWEEN %(d)s::date - 1 AND %(d)s::date) t
        WHERE date = %(d)s
        GROUP BY device_ip
    """, {"d": d})
    out, total = [], 0
    for r in cur.fetchall():
        total += r["doubles"]
        if r["doubles"] >= DOUBLE_MIN and r["doubles"] / r["n"] >= DOUBLE_RATIO_WARN:
            ratio = r["doubles"] / r["n"]
            out.append(mk(d, "double_punches", "warning", "device", r["device_ip"],
                          f"Pointeuse {r['device_ip']} : doubles pointages",
                          f"{r['doubles']} doubles pointages (moins de 2 minutes) sur {r['n']} le {d} ({ratio:.0%}). "
                          f"Possible problème de lecture biométrique ou de pointeuse.",
                          {"doubles": r["doubles"], "punches": r["n"], "ratio": round(ratio, 3)}))
    return out, total


def rule_incomplete_days(cur, d):
    cur.execute("""
        SELECT count(*) FILTER (WHERE mod(c, 2) = 1) AS odd, count(*) AS users
        FROM (SELECT user_id, count(*) AS c
              FROM (SELECT user_id, date,
                           device_timestamp - lag(device_timestamp) OVER (PARTITION BY user_id ORDER BY device_timestamp) AS gap
                    FROM attendance
                    WHERE date BETWEEN %(d)s::date - 1 AND %(d)s::date) x
              WHERE date = %(d)s AND (gap IS NULL OR gap >= interval '2 minutes')
              GROUP BY user_id) t
    """, {"d": d})
    r = cur.fetchone()
    odd, users = r["odd"], r["users"]
    ratio = odd / users if users else 0
    out = []
    if users >= INCOMPLETE_MIN_USERS and ratio >= ODD_RATIO_WARN:
        sev = "critical" if ratio >= ODD_RATIO_CRIT else "warning"
        out.append(mk(d, "incomplete_days", sev, "global", "", "Journées incomplètes (pointage manquant)",
                      f"{odd} employés sur {users} ({ratio:.0%}) ont un nombre impair de pointages le {d} "
                      f"(entrée ou sortie manquante).",
                      {"odd_users": odd, "users": users, "ratio": round(ratio, 3)}))
    return out, odd, users


def rule_clock_drift(cur, d):
    cur.execute("""
        SELECT device_ip, count(*) AS n, max(device_timestamp) AS latest
        FROM attendance
        WHERE date >= %(d)s::date - 1
          AND device_timestamp > (now() AT TIME ZONE 'Indian/Antananarivo') + make_interval(mins => %(m)s)
        GROUP BY device_ip
    """, {"d": d, "m": DRIFT_MINUTES})
    return [mk(d, "clock_drift", "warning", "device", r["device_ip"],
               f"Pointeuse {r['device_ip']} : horloge en avance",
               f"{r['n']} pointages datés dans le futur (dernier : {r['latest']}). L'horloge de la pointeuse "
               f"semble déréglée.", {"count": r["n"], "latest": str(r["latest"])}) for r in cur.fetchall()]


def analyse(cur, d):
    out = []
    g, global_drop = rule_global_volume(cur, d)
    out += g
    if not global_drop:  # if everything dropped, per-device alerts would only add noise
        out += rule_device_volume(cur, d)
        seen = {a["scope_value"] for a in out if a["rule"] == "site_volume_drop"}
        out += [a for a in rule_site_volume(cur, d) if a["scope_value"] not in seen]
        out = tidy(d, out)
    dbl, total_doubles = rule_double_punches(cur, d)
    out += dbl
    inc, odd, users = rule_incomplete_days(cur, d)
    out += inc
    if d >= datetime.now(TZ).date() - timedelta(days=1):
        out += rule_clock_drift(cur, d)
    cur.execute("SELECT count(*) AS n, count(DISTINCT user_id) AS u, count(DISTINCT device_ip) AS dev "
                "FROM attendance WHERE date = %(d)s", {"d": d})
    s = cur.fetchone()
    if s["n"] == 0 and not out:
        return []  # no activity and no alert (Sunday / holiday): nothing to report
    n_alerts = len(out)
    out.append(mk(d, "daily_summary", "info", "global", "", f"Résumé du {d}",
                  f"{s['n']} pointages, {s['u']} employés, {s['dev']} pointeuses actives. "
                  f"{odd} journées incomplètes, {total_doubles} doubles pointages, {n_alerts} alerte(s).",
                  {"punches": s["n"], "users": s["u"], "devices": s["dev"], "odd_users": odd,
                   "double_punches": total_doubles, "alerts": n_alerts}, kind="info"))
    return out


UPSERT = """
INSERT INTO insights (insight_date, kind, rule, severity, scope_type, scope_value, title, message, payload)
VALUES (%(d)s, %(kind)s, %(rule)s, %(severity)s, %(scope_type)s, %(scope_value)s, %(title)s, %(message)s, %(payload)s)
ON CONFLICT (insight_date, kind, rule, scope_type, scope_value)
DO UPDATE SET severity = EXCLUDED.severity, title = EXCLUDED.title, message = EXCLUDED.message,
              payload = EXCLUDED.payload, updated_at = now()
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", type=date.fromisoformat, help="last day to analyse (default: yesterday)")
    ap.add_argument("--days", type=int, default=1, help="analyse N days ending at --date (backfill)")
    ap.add_argument("--dry-run", action="store_true", help="print only, write nothing")
    a = ap.parse_args()
    end = a.date or (datetime.now(TZ).date() - timedelta(days=1))
    dsn = os.environ["DATABASE_URL"].replace("+asyncpg", "").replace("+psycopg2", "")
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for i in range(a.days - 1, -1, -1):
                d = end - timedelta(days=i)
                rows = analyse(cur, d)
                for r in rows:
                    print(f"[{r['d']}] {r['severity']:<8} {r['rule']:<20} {r['scope_value'] or '-':<16} {r['message']}")
                if not a.dry_run:
                    for r in rows:
                        cur.execute(UPSERT, {**r, "payload": Json(r["payload"])})
        if not a.dry_run:
            conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
