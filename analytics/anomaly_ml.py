#!/usr/bin/env python3
"""ML anomaly detection on punch devices (Isolation Forest), compared with the rule-based job.

One row per device and weekday. Features are RELATIVE to the device's own recent normal
(previous 28 weekdays), so small and large devices share one model:
  dev_volume = |1 - volume / usual volume|, dbl_rate = double-punch share,
  odd_rate = share of incomplete days, shape_dev = change of the morning/evening punch profile.
A day is flagged if Isolation Forest finds it odd (several signals together) OR one signal is extreme
(robust z-score guard: Isolation Forest cannot isolate a value beyond the range it saw in training).
Usage (from analytics/, with DATABASE_URL set):
  python anomaly_ml.py                      # evaluate on the last 56 days, dry run
  python anomaly_ml.py --device 192.168.1.225
  python anomaly_ml.py --test-days 3 --write   # nightly: score the last 3 days into `insights`
"""
import argparse
import os

import numpy as np
import pandas as pd
from psycopg2.extras import Json
from sklearn.ensemble import IsolationForest

COLLECTIVE_LEAVE = ("2026-08-01", "2026-08-16")
MIN_BASE_VOLUME = 50            # ignore devices with a typical day under 50 punches
Z_FLAG = 6.0                   # guard: robust z-score above this on ONE feature is flagged too
# every feature is "higher = more abnormal", which is what Isolation Forest isolates fastest
FEATS = ["dev_volume", "dbl_rate", "odd_rate", "shape_dev"]
SQL = """
WITH p AS (
  SELECT device_ip, user_id, date, device_timestamp,
         device_timestamp - lag(device_timestamp) OVER (PARTITION BY user_id ORDER BY device_timestamp) AS gap
  FROM attendance WHERE date >= %(start)s),
u AS (
  SELECT device_ip, date, user_id, count(*) AS c,
         count(*) FILTER (WHERE gap IS NULL OR gap >= interval '2 minutes') AS c_clean,
         count(*) FILTER (WHERE extract(hour FROM device_timestamp) BETWEEN 5 AND 8) AS morning,
         count(*) FILTER (WHERE extract(hour FROM device_timestamp) BETWEEN 15 AND 19) AS evening
  FROM p GROUP BY 1, 2, 3)
SELECT device_ip, date, sum(c) AS n, count(*) AS users, sum(c - c_clean) AS dbl,
       count(*) FILTER (WHERE c_clean %% 2 = 1) AS odd, sum(morning) AS morning, sum(evening) AS evening
FROM u GROUP BY 1, 2
"""
UPSERT = """
INSERT INTO insights (insight_date, kind, rule, severity, scope_type, scope_value, title, message, payload)
VALUES (%(d)s, 'anomaly', 'iforest_device', %(severity)s, 'device', %(ip)s, %(title)s, %(message)s, %(payload)s)
ON CONFLICT (insight_date, kind, rule, scope_type, scope_value)
DO UPDATE SET severity = EXCLUDED.severity, title = EXCLUDED.title, message = EXCLUDED.message,
              payload = EXCLUDED.payload, updated_at = now()
"""


def connect():
    import psycopg2
    dsn = os.environ["DATABASE_URL"].replace("+asyncpg", "").replace("+psycopg2", "")
    return psycopg2.connect(dsn)


def load_device_days(start="2026-01-01"):
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(SQL, {"start": start})
            cols = ["device_ip", "date", "n", "users", "dbl", "odd", "morning", "evening"]
            return pd.DataFrame(cur.fetchall(), columns=cols).astype({"n": float, "users": float,
                   "dbl": float, "odd": float, "morning": float, "evening": float})
    finally:
        conn.close()


def load_rule_alerts():
    """Warning/critical alerts of the rule-based job, to compare with the ML flags."""
    try:
        conn = connect()
        with conn.cursor() as cur:
            cur.execute("SELECT insight_date, rule, scope_type, scope_value FROM insights "
                        "WHERE kind='anomaly' AND severity IN ('warning','critical')")
            r = pd.DataFrame(cur.fetchall(), columns=["date", "rule", "scope_type", "scope_value"])
        conn.close()
        r["date"] = pd.to_datetime(r["date"])
        return r
    except Exception as e:  # table missing or DB unreachable: skip the comparison
        print("rule alerts unavailable:", e)
        return pd.DataFrame(columns=["date", "rule", "scope_type", "scope_value"])


def build_features(df):
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df[df["date"].dt.day_of_week < 5]
    end = df["date"].max()
    parts = []
    for ip, g in df.groupby("device_ip"):
        last = end if g["date"].max() >= end - pd.Timedelta(days=14) else g["date"].max()
        idx = pd.bdate_range(g["date"].min(), last)          # include days with ZERO punches
        g = g.set_index("date").reindex(idx)
        g["device_ip"] = ip
        g[["n", "users", "dbl", "odd", "morning", "evening"]] = g[["n", "users", "dbl", "odd", "morning", "evening"]].fillna(0)
        g.index.name = "date"
        parts.append(g.reset_index())
    f = pd.concat(parts, ignore_index=True)

    tot = f.groupby("date")["n"].sum()                       # drop system-wide outage / leave days:
    ref = tot.rolling(21, center=True, min_periods=5).median()   # those belong to the global rule
    bad = set(tot.index[(tot < 0.5 * ref) | ((tot.index >= COLLECTIVE_LEAVE[0]) & (tot.index <= COLLECTIVE_LEAVE[1]))])
    f = f[~f["date"].isin(bad)].sort_values(["device_ip", "date"]).reset_index(drop=True)

    nn = f["n"].replace(0, np.nan)
    f["share_morning"] = f["morning"] / nn
    f["share_evening"] = f["evening"] / nn
    f["dbl_rate"] = f["dbl"] / nn
    f["odd_rate"] = f["odd"] / f["users"].replace(0, np.nan)
    g = f.groupby("device_ip")
    base = lambda col: g[col].transform(lambda s: s.shift(1).rolling(28, min_periods=8).median())
    f["base_n"], f["base_users"] = base("n"), base("users")
    f["base_sm"], f["base_se"] = base("share_morning"), base("share_evening")
    f = f[(f["base_n"] >= MIN_BASE_VOLUME) & (f["base_users"] > 0)].copy()
    f["rel_volume"] = (f["n"] / f["base_n"]).clip(upper=3)
    f["dev_volume"] = (1 - f["rel_volume"]).abs()
    sm, se = f["share_morning"].fillna(f["base_sm"]), f["share_evening"].fillna(f["base_se"])
    f["shape_dev"] = ((sm - f["base_sm"]).abs() + (se - f["base_se"]).abs()).fillna(0)
    for c in ("dbl_rate", "odd_rate"):                       # empty days: neutral value, volume carries the signal
        f[c] = f[c].fillna(f.groupby("device_ip")[c].transform("median")).fillna(0)
    return f.reset_index(drop=True)


def fit_and_score(f, test_start, z_flag=Z_FLAG):
    train, test = f[f["date"] < test_start], f[f["date"] >= test_start].copy()
    iso = IsolationForest(n_estimators=300, random_state=0).fit(train[FEATS])
    tr = iso.decision_function(train[FEATS])
    thr_warn, thr_crit = np.percentile(tr, 1.5), np.percentile(tr, 0.3)
    med = train[FEATS].median()
    mad = ((train[FEATS] - med).abs().median() * 1.4826).clip(lower=0.01)
    z = (test[FEATS] - med) / mad
    test["score"] = iso.decision_function(test[FEATS])
    test["zmax"] = z.max(axis=1)           # features are "higher = worse", so only the upper side counts
    flag_if, flag_z = test["score"] < thr_warn, test["zmax"] >= z_flag
    test["flag"] = flag_if | flag_z
    test["source"] = np.where(flag_if & flag_z, "both", np.where(flag_if, "iforest", "zscore"))
    test["severity"] = np.where((test["score"] < thr_crit) | (test["zmax"] >= 2 * z_flag), "critical", "warning")
    test["reason"] = z.idxmax(axis=1)
    test["direction"] = np.where(test["reason"] == "dev_volume",
                                 np.where(test["rel_volume"] < 1, "baisse", "hausse"), "")
    print(f"train rows={len(train)}  test rows={len(test)}  flagged={int(test['flag'].sum())} "
          f"(iforest score < {thr_warn:.3f} or robust z >= {z_flag:g})")
    return test


def compare_with_rules(test, rules):
    if rules.empty:
        return test.assign(by_rules=False)
    dev = rules[rules["scope_type"] == "device"].groupby("date")["scope_value"].apply(set).to_dict()
    site = rules[rules["scope_type"] == "site"].groupby("date")["scope_value"].apply(set).to_dict()

    def covered(r):
        if r["device_ip"] in dev.get(r["date"], set()):
            return True
        net = r["device_ip"].rsplit(".", 1)[0] + ".0/24"
        return net in site.get(r["date"], set())
    return test.assign(by_rules=test.apply(covered, axis=1))


def report(test, args):
    test = test.copy()
    cols = ["date", "device_ip", "source", "score", "zmax", "rel_volume", "dbl_rate", "odd_rate", "reason", "direction"]
    num = {c: 3 for c in ["score", "zmax", "rel_volume", "dbl_rate", "odd_rate"]}
    if args.device:
        t = test[test["device_ip"] == args.device].sort_values("date")
        print(f"\nscore timeline for {args.device} (flag = ML anomaly, rules = rule-based alert):")
        print(t[cols + ["flag", "by_rules"]].round(num).tail(25).to_string(index=False))
        return
    fl = test[test["flag"]].sort_values("score")
    both, ml_only = fl[fl["by_rules"]], fl[~fl["by_rules"]]
    rules_only = int(((~test["flag"]) & test["by_rules"]).sum())
    print(f"\nML flags: {len(fl)} | also raised by rules: {len(both)} | ML only (to review): {len(ml_only)} "
          f"| rules only (ML missed): {rules_only}")
    print("\nML-only flags, most abnormal first (review these: real incident or false positive?):")
    print(ml_only[cols].round(num).head(25).to_string(index=False))
    os.makedirs(args.out, exist_ok=True)
    fl[cols + ["by_rules", "severity"]].to_csv(os.path.join(args.out, "iforest_flags.csv"), index=False)
    print(f"\nwrote {args.out}/iforest_flags.csv")


def write_insights(test):
    conn = connect()
    try:
        with conn.cursor() as cur:
            for _, r in test[test["flag"]].iterrows():
                why = {"dev_volume": f"volume en {r['direction']} ({r['rel_volume']:.0%} de l'habituel)",
                       "dbl_rate": f"taux élevé de doubles pointages ({r['dbl_rate']:.0%})",
                       "odd_rate": f"forte part d'employés avec un seul pointage sur cette pointeuse ({r['odd_rate']:.0%})",
                       "shape_dev": "répartition horaire des pointages inhabituelle"}[r["reason"]]
                msg = (f"Comportement inhabituel de la pointeuse {r['device_ip']} le {r['date'].date()} "
                       f"(modèle Isolation Forest) : {why}.")
                cur.execute(UPSERT, {"d": r["date"].date(), "severity": r["severity"], "ip": r["device_ip"],
                                     "title": f"Pointeuse {r['device_ip']} : comportement inhabituel (ML)",
                                     "message": msg,
                                     "payload": Json({"score": round(float(r["score"]), 4), "source": r["source"], "reason": r["reason"],
                                                      "rel_volume": round(float(r["rel_volume"]), 3)})})
        conn.commit()
    finally:
        conn.close()


def main(argv=None, df=None, rules=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--test-days", type=int, default=56, help="last N days are scored, earlier days train")
    ap.add_argument("--device", help="print the score timeline of one device")
    ap.add_argument("--z", type=float, default=Z_FLAG, help="robust z-score guard (one-feature extremes)")
    ap.add_argument("--as-of", help="ignore days from this date on (default: today, the day is incomplete)")
    ap.add_argument("--write", action="store_true", help="write ML flags into the insights table")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "out"))
    args = ap.parse_args(argv)
    raw = load_device_days() if df is None else df
    as_of = (pd.Timestamp(args.as_of) if args.as_of
             else pd.Timestamp.now(tz="Indian/Antananarivo").tz_localize(None).normalize())
    raw = raw[pd.to_datetime(raw["date"]) < as_of]
    f = build_features(raw)
    test_start = f["date"].max() - pd.Timedelta(days=args.test_days - 1)
    test = fit_and_score(f, test_start, args.z)
    test = compare_with_rules(test, load_rule_alerts() if rules is None else rules)
    report(test, args)
    if args.write:
        write_insights(test)
        print("flags written to insights (rule = iforest_device)")


if __name__ == "__main__":
    main()
