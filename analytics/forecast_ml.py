#!/usr/bin/env python3
"""Forecast daily lates and overtime hours one week ahead and check whether ML beats naive baselines.

Input: analytics/out/daily_series.csv (date, present, late, ot_hours), produced by export_daily_series.py,
which reuses the HR dashboard services (per-employee schedules, HC excluded). This script has NO database access.

Evaluation is walk-forward: for each of the last N weeks, train only on days before that week's Monday and
predict its 5 days using only information available before Monday (a true "next week" forecast).
Models: naive (same weekday last week), moving averages, Ridge, shallow Random Forest.

Usage (from the pointage root):
  analytics/.venv/bin/python analytics/forecast_ml.py                 # last 8 weeks
  analytics/.venv/bin/python analytics/forecast_ml.py --weeks 12 --predict
"""
import argparse
import os
from datetime import timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge

COLLECTIVE_LEAVE = ("2026-08-01", "2026-08-16")
TARGETS = ["late", "ot_hours"]
HERE = os.path.dirname(os.path.abspath(__file__))


def _robust_z(x):
    """Distance to the rolling median, in robust standard deviations (MAD)."""
    med = x.rolling(21, center=True, min_periods=5).median()
    mad = (x - med).abs().rolling(21, center=True, min_periods=5).median() * 1.4826
    return (x - med).abs() / mad.clip(lower=max(1.0, 0.02 * float(x.median())))


def load_daily(path, clean_z=6.0, targets=None, drop_dates=None, verbose=True):
    targets = targets or TARGETS
    d = pd.read_csv(path, parse_dates=["date"]).set_index("date").sort_index()
    d = d[d.index.day_of_week < 5]
    d = d.reindex(pd.bdate_range(d.index.min(), d.index.max())).fillna(0)
    ref = d["present"].rolling(21, center=True, min_periods=5).median()
    outage = (d["present"] < 0.5 * ref) | ((d.index >= COLLECTIVE_LEAVE[0]) & (d.index <= COLLECTIVE_LEAVE[1]))
    # days that look like a clock/timezone problem or a one-off event: almost everyone late, or a late count /
    # overtime total far from the usual level. They are removed so they do not poison the moving averages.
    rate = d["late"] / d["present"].replace(0, np.nan)
    odd = rate > 0.25
    for t in targets:
        odd = odd | (_robust_z(d[t]) > clean_z)
    if drop_dates:                      # known holidays / early-closing days given by the user
        odd = odd | d.index.isin(pd.to_datetime(drop_dates))
    if verbose and (odd & ~outage).any():
        print(f"removed {int((odd & ~outage).sum())} unusual days (robust z > {clean_z:g} or > 25% late):")
        print(d[odd & ~outage].round(1).to_string())
    return d[~(outage | odd)]


def features(daily, target, day):
    """Features for `day`, using only data strictly before that week's Monday."""
    ws = day - timedelta(days=day.weekday())
    hist = daily[daily.index < ws]
    if len(hist) < 25:
        return None
    s = hist[target]
    lw = daily[target].get(day - timedelta(days=7), np.nan)
    if np.isnan(lw):
        lw = s.tail(5).mean()
    row = {"same_dow_lw": lw, "m5": s.tail(5).mean(), "m20": s.tail(20).mean(),
           "pres_m5": hist["present"].tail(5).mean(), "monthend": float(day.day >= 25)}
    for k in range(5):
        row[f"dow{k}"] = float(day.weekday() == k)
    return row


def build(daily, target):
    rows = []
    for day in daily.index:
        f = features(daily, target, day)
        if f is not None:
            f.update(date=day, y=daily.loc[day, target])
            rows.append(f)
    return pd.DataFrame(rows)


def models():
    return {"ridge": Ridge(alpha=5.0),
            "rforest": RandomForestRegressor(n_estimators=300, max_depth=3, min_samples_leaf=5, random_state=0)}


def evaluate(daily, target, weeks):
    df = build(daily, target)
    if df.empty:
        raise SystemExit("not enough history: export more months (>= 3 recommended, 10 ideal)")
    cols = [c for c in df.columns if c not in ("date", "y")]
    mondays = sorted({d - timedelta(days=d.weekday()) for d in df["date"]})[-weeks:]
    preds = []
    for mon in mondays:
        tr, te = df[df["date"] < mon], df[(df["date"] >= mon) & (df["date"] < mon + timedelta(days=7))]
        if te.empty or len(tr) < 30:
            continue
        out = te[["date", "y"]].copy()
        out["week"] = mon
        out["naive_lw"], out["ma5"], out["ma20"] = te["same_dow_lw"], te["m5"], te["m20"]
        for name, m in models().items():
            out[name] = m.fit(tr[cols], tr["y"]).predict(te[cols])
        preds.append(out)
    if not preds:
        raise SystemExit("not enough history to evaluate: export more months")
    p = pd.concat(preds, ignore_index=True)
    names = ["naive_lw", "ma5", "ma20", "ridge", "rforest"]
    daily_mae = {n: (p[n] - p["y"]).abs().mean() for n in names}
    wk = p.groupby("week")[["y"] + names].sum()
    weekly_mae = {n: (wk[n] - wk["y"]).abs().mean() for n in names}
    print(f"\n=== {target}: walk-forward over {len(wk)} weeks, mean actual/day = {p['y'].mean():.1f}")
    res = pd.DataFrame({"MAE_day": daily_mae, "MAE_week": weekly_mae})
    res["vs_naive_%"] = (1 - res["MAE_week"] / res.loc["naive_lw", "MAE_week"]) * 100
    print(res.round(2).to_string())
    best = res["MAE_week"].idxmin()
    verdict = "ML beats the naive baseline" if best in ("ridge", "rforest") else "no ML gain over simple baselines"
    print(f"best on weekly MAE: {best}  ->  {verdict}")
    return df, cols, best


def predict_next_week(daily, target, df, cols, best):
    last = daily.index.max()
    mon = last + timedelta(days=7 - last.weekday())
    days = [mon + timedelta(days=k) for k in range(5)]
    ext = pd.concat([daily, pd.DataFrame(index=pd.DatetimeIndex(days), columns=daily.columns, dtype=float)])
    x = pd.DataFrame([features(ext, target, d) for d in days])[cols]
    if best in models():
        y = models()[best].fit(df[cols], df["y"]).predict(x)
    else:
        y = x[{"naive_lw": "same_dow_lw", "ma5": "m5", "ma20": "m20"}[best]].to_numpy()
    print(f"forecast {target} week of {mon.date()} ({best}): "
          + ", ".join(f"{d.strftime('%a')} {v:.1f}" for d, v in zip(days, y)) + f"  | total {y.sum():.1f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=os.path.join(HERE, "out", "daily_series.csv"))
    ap.add_argument("--weeks", type=int, default=8)
    ap.add_argument("--targets", default="late,ot_hours", help="comma list: late, ot_hours (use late if overtime is not available)")
    ap.add_argument("--clean-z", type=float, default=6.0, help="drop days further than this many robust sigmas from normal")
    ap.add_argument("--predict", action="store_true")
    ap.add_argument("--drop-dates", default="", help="comma list of YYYY-MM-DD to exclude (holidays, early finishes)")
    a = ap.parse_args()
    targets = [t.strip() for t in a.targets.split(",") if t.strip()]
    drop = [x.strip() for x in a.drop_dates.split(",") if x.strip()]
    daily = load_daily(a.csv, a.clean_z, targets, drop)
    print(f"{len(daily)} usable working days, {daily.index.min().date()} -> {daily.index.max().date()}")
    for t in targets:
        df, cols, best = evaluate(daily, t, a.weeks)
        if a.predict:
            predict_next_week(daily, t, df, cols, best)


if __name__ == "__main__":
    main()