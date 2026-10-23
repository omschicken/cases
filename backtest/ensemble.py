"""Портфель трендовых правил (лонг-онли) по BTC/ETH/XRP с таргетированием волатильности.

python ensemble.py <папка_с_4h_csv>

Сигнал монеты = доля из 6 стандартных трендовых правил, которые сейчас "в лонге" (0..1).
Экспозиция = сигнал * min(cap, target_vol / реализованная_vol). Ребаланс по open следующего бара, если цель
отличается от текущей > band (или цель = 0). Издержки: (fee + slip) * |изменение экспозиции|.
Три независимых "кармана" по 1/3 капитала.
"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import strategies as S  # noqa: E402

SYMS = ["BTCUSDT", "ETHUSDT", "XRPUSDT"]
BPY = 2190
CUT = pd.Timestamp("2023-09-24")
RULES = {
    "Bollinger breakout": S.bb_breakout,
    "Turtle 55/20": lambda d: S.turtle(d, 55, 20),
    "SMA200": S.sma_trend,
    "ROC 30д": lambda d: S.roc(d, 180),
    "Ichimoku": S.ichimoku,
    "Supertrend 10/3": S.supertrend,
}


def load(data):
    dfs = {}
    for s in SYMS:
        d = pd.read_csv(f"{data}/{s}_4h.csv")
        d.index = pd.to_datetime(d.t, unit="ms")
        dfs[s] = d
    idx = dfs[SYMS[0]].index
    for s in SYMS[1:]:
        idx = idx.intersection(dfs[s].index)
    return {s: dfs[s].loc[idx] for s in SYMS}, idx


def signal(d, rules):
    arr = {k: d[k].values for k in "ohlc"}
    sig = np.mean([np.clip(np.nan_to_num(RULES[r](arr)), 0, 1) for r in rules], axis=0)
    return arr, sig


def sleeve(arr, sig, target_vol=None, cap=1.0, band=0.15, fee=0.0004, slip=0.0001, buy_hold=False):
    o, c = arr["o"], arr["c"]
    n = len(c)
    ret = np.diff(np.log(c), prepend=0.0)
    rv = pd.Series(ret).rolling(180).std().values * np.sqrt(BPY)           # реализованная vol, 30 дней
    if buy_hold:
        target = np.ones(n)
    elif target_vol:
        target = sig * np.minimum(cap, target_vol / np.where(rv > 0, rv, np.inf))
        target = np.nan_to_num(target)
    else:
        target = sig * cap
    cost = fee + slip
    eq, cur = 1.0, 0.0
    curve = np.empty(n)
    for i in range(n):
        if i >= 1:
            tgt = target[i - 1]                                              # решение по закрытию i-1
            eq *= 1 + cur * (o[i] / c[i - 1] - 1)
            if (abs(tgt - cur) > band and not np.isnan(tgt)) or (tgt == 0 and cur != 0):
                eq *= 1 - cost * abs(tgt - cur)
                cur = tgt
            eq *= 1 + cur * (c[i] / o[i] - 1)
        curve[i] = eq
    return curve


def metrics(curve, idx, a, b):
    cv = curve[a:b] / curve[a - 1]
    r = np.diff(np.r_[1.0, cv]) / np.r_[1.0, cv[:-1]]
    peak = np.maximum.accumulate(cv)
    yrs = (b - a) / BPY
    return dict(ret=(cv[-1] - 1) * 100, cagr=(cv[-1] ** (1 / yrs) - 1) * 100, dd=((peak - cv) / peak).max() * 100,
                sharpe=r.mean() / r.std() * np.sqrt(BPY) if r.std() > 0 else 0.0)


def portfolio(dfs, idx, variant, rules, cost_mult=1.0):
    curves = []
    for s in SYMS:
        arr, sig = signal(dfs[s], rules)
        curves.append(sleeve(arr, sig, fee=0.0004 * cost_mult, slip=0.0001 * cost_mult, **variant))
    return np.mean(curves, axis=0), curves


def yearly(curve, idx, a):
    yrs = idx[a:].year.values
    cv = curve[a - 1:]
    out = {}
    for y in np.unique(yrs):
        m = np.flatnonzero(yrs == y)
        start = cv[m[0]]
        out[int(y)] = (cv[m[-1] + 1] / start - 1) * 100
    return out


if __name__ == "__main__":
    dfs, idx = load(sys.argv[1])
    a0 = 250
    cut = int(np.searchsorted(idx.values, CUT.to_datetime64()))
    n = len(idx)
    print("общий период:", idx[0].date(), "->", idx[-1].date(), f"({n / BPY:.1f} лет)")
    variants = {
        "Buy&Hold (1/3 каждая)": dict(buy_hold=True, band=0.5),
        "Ансамбль, без vol-таргета": dict(),
        "Ансамбль + vol-таргет 50%, cap 1x": dict(target_vol=0.5, cap=1.0),
        "Ансамбль + vol-таргет 50%, cap 2x": dict(target_vol=0.5, cap=2.0),
    }
    pd.set_option("display.width", 250)
    rows = []
    store = {}
    for name, v in variants.items():
        for cm in (1.0, 3.0):
            if cm == 3.0 and name.startswith("Buy"):
                continue
            curve, sleeves = portfolio(dfs, idx, v, list(RULES), cm)
            store[(name, cm)] = curve
            for pname, (a, b) in {"весь": (a0, n), "pre (до 09.2023)": (a0, cut), "last3y": (cut, n)}.items():
                rows.append(dict(вариант=name, издержки=f"x{cm:g}", период=pname, **metrics(curve, idx, a, b)))
    print(pd.DataFrame(rows).round(2).to_string(index=False))
    print("\nДоходность по календарным годам, % (издержки x1):")
    print(pd.DataFrame({k[0]: yearly(v, idx, a0) for k, v in store.items() if k[1] == 1.0}).round(0).T.to_string())
    print("\nОтдельные карманы (ансамбль + vol-таргет 50%, cap 1x), весь период:")
    _, sl = portfolio(dfs, idx, variants["Ансамбль + vol-таргет 50%, cap 1x"], list(RULES))
    for s, cv in zip(SYMS, sl):
        print(s, {k: round(v, 2) for k, v in metrics(cv, idx, a0, n).items()})
    print("\nЛеave-one-out по правилам (ансамбль + vol-таргет 50%, cap 1x), весь период:")
    for r in RULES:
        rules = [x for x in RULES if x != r]
        cv, _ = portfolio(dfs, idx, variants["Ансамбль + vol-таргет 50%, cap 1x"], rules)
        print(f"без {r:20s}", {k: round(v, 2) for k, v in metrics(cv, idx, a0, n).items()})
