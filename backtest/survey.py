"""Обзор популярных стратегий на длинной истории: python survey.py <папка_с_4h_csv>

Стандартные параметры, без подгонки. Периоды: весь, до 2023-09-24 (pre) и после (last3y).
Варианты: L/S (лонг+шорт) и LO (только лонг).
"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import strategies as S  # noqa: E402

SYMS = ["BTCUSDT", "ETHUSDT", "XRPUSDT"]
CUT = pd.Timestamp("2023-09-24")
WARM = 250


def load(sym, tf, data):
    d = pd.read_csv(f"{data}/{sym}_4h.csv")
    d.index = pd.to_datetime(d.t, unit="ms")
    if tf == "1d":
        d = d.resample("1D").agg({"t": "first", "o": "first", "h": "max", "l": "min", "c": "last", "v": "sum"}).dropna()
    return d


def signals(d, tf):
    day = 6 if tf == "4h" else 1
    arr = {k: d[k].values for k in "ohlc"}
    out = {}
    for name, fn in S.STRATS.items():
        if name == "Momentum ROC(30д)":
            fn = lambda x, n=30 * day: S.roc(x, n)
        elif name == "Momentum ROC(90д)":
            fn = lambda x, n=90 * day: S.roc(x, n)
        out[name] = np.asarray(fn(arr), dtype=float)
    return arr, out


def periods(d):
    idx = d.index
    n = len(d)
    cut = int(np.searchsorted(idx.values, CUT.to_datetime64()))
    return {"full": (WARM, n), "pre": (WARM, cut), "last3y": (cut, n)}


def run(data, tf):
    bpy = 2190 if tf == "4h" else 365
    rows, yearly = [], {}
    for sym in SYMS:
        d = load(sym, tf, data)
        arr, sig = signals(d, tf)
        per = periods(d)
        for name, s in sig.items():
            for var, sv in (("L/S", s), ("LO", np.clip(s, 0, 1))):
                if name in ("Buy&Hold", "SMA200 тренд (long/flat)", "Connors RSI-2") and var == "L/S":
                    if name != "Connors RSI-2":
                        continue
                for pname, (a, b) in per.items():
                    if b - a < 100:
                        continue
                    r = S.backtest(arr, sv, a, b, bpy)
                    rows.append(dict(tf=tf, sym=sym, strat=name, var=var, period=pname, **{k: v for k, v in r.items() if k != "curve"}))
                    if pname == "full":
                        cv, yrs = r["curve"], d.index[a:b].year.values
                        ys = {}
                        for y in np.unique(yrs):
                            m = yrs == y
                            start_eq = cv[np.flatnonzero(m)[0] - 1] if np.flatnonzero(m)[0] > 0 else 1.0
                            ys[int(y)] = (cv[m][-1] / start_eq - 1) * 100
                        yearly[(tf, sym, name, var)] = ys
    return pd.DataFrame(rows), yearly


def summarize(df, tf):
    g = df[df.tf == tf]
    out = []
    for (strat, var), x in g.groupby(["strat", "var"]):
        row = dict(strat=strat, var=var)
        for p in ("pre", "last3y", "full"):
            y = x[x.period == p]
            row[f"sh_{p}"] = y.sharpe.mean()
            row[f"pos_{p}"] = int((y.ret > 0).sum())
        f = x[x.period == "full"]
        row["ret_full"] = f.ret.mean()
        row["cagr"] = f.cagr.mean()
        row["dd_max"] = f.dd.max()
        row["trades"] = f.trades.mean()
        row["wr"] = f.wr.mean()
        row["pf"] = f.pf.replace(np.inf, np.nan).mean()
        row["expo"] = f.expo.mean()
        out.append(row)
    return pd.DataFrame(out).sort_values("sh_full", ascending=False)


if __name__ == "__main__":
    data = sys.argv[1]
    pd.set_option("display.width", 250)
    pd.set_option("display.max_columns", 40)
    allr, ys = [], {}
    for tf in ("4h", "1d"):
        df, y = run(data, tf)
        allr.append(df)
        ys.update(y)
        sm = summarize(df, tf)
        print(f"\n===== ТФ {tf}: среднее по BTC/ETH/XRP (Sharpe по периодам; pos_* = число пар из 3 с прибылью) =====")
        print(sm.round(2).to_string(index=False))
    pd.concat(allr).to_csv("survey.csv", index=False)
    pd.to_pickle(ys, "survey_yearly.pkl")
