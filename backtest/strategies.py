"""Популярные «трейдерские» стратегии со стандартными параметрами (без подгонки) и общий движок.

Сигнал s[i] in {-1, 0, +1} определяется по закрытию бара i, позиция берётся по open бара i+1.
Издержки: fee + slip на сторону при каждом изменении позиции (разворот = две стороны). Плечо 1x (позиция = весь капитал).
Фандинг на перпетуалах не учитывается.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


# ───────────────────────── индикаторы ─────────────────────────
def ema(x, n):
    return pd.Series(x).ewm(span=n, adjust=False).mean().values


def sma(x, n):
    return pd.Series(x).rolling(n).mean().values


def rma(x, n):
    return pd.Series(x).ewm(alpha=1 / n, adjust=False).mean().values


def true_range(h, l, c):
    pc = np.r_[c[0], c[:-1]]
    return np.maximum(h - l, np.maximum(np.abs(h - pc), np.abs(l - pc)))


def atr(h, l, c, n=14):
    return rma(true_range(h, l, c), n)


def rsi(c, n=14):
    d = np.diff(c, prepend=c[0])
    up, dn = rma(np.maximum(d, 0), n), rma(np.maximum(-d, 0), n)
    return 100 - 100 / (1 + up / np.where(dn == 0, 1e-12, dn))


def adx_di(h, l, c, n=14):
    up, dn = np.diff(h, prepend=h[0]), -np.diff(l, prepend=l[0])
    pdm, mdm = np.where((up > dn) & (up > 0), up, 0.0), np.where((dn > up) & (dn > 0), dn, 0.0)
    a = atr(h, l, c, n)
    pdi, mdi = 100 * rma(pdm, n) / a, 100 * rma(mdm, n) / a
    dx = 100 * np.abs(pdi - mdi) / np.where(pdi + mdi == 0, 1e-12, pdi + mdi)
    return rma(dx, n), pdi, mdi


def roll_max(x, n):
    return pd.Series(x).rolling(n).max().values


def roll_min(x, n):
    return pd.Series(x).rolling(n).min().values


def state(long_in, long_out, short_in, short_out):
    """Машина состояний из условий входа/выхода (все массивы bool)."""
    n = len(long_in)
    out = np.zeros(n)
    s = 0
    for i in range(n):
        if s == 1 and long_out[i]:
            s = 0
        elif s == -1 and short_out[i]:
            s = 0
        if s == 0:
            if long_in[i]:
                s = 1
            elif short_in[i]:
                s = -1
        out[i] = s
    return out


def sh(x, k=1):
    """Значение k баров назад (предыдущий бар), NaN в начале."""
    return np.r_[np.full(k, np.nan), x[:-k]]


# ───────────────────────── стратегии ─────────────────────────
def turtle(d, n_in, n_out):
    h, l, c = d["h"], d["l"], d["c"]
    hi, lo = sh(roll_max(h, n_in)), sh(roll_min(l, n_in))
    xh, xl = sh(roll_max(h, n_out)), sh(roll_min(l, n_out))
    return state(c > hi, c < xl, c < lo, c > xh)


def adx_rider(d):
    h, l, c = d["h"], d["l"], d["c"]
    adx, pdi, mdi = adx_di(h, l, c, 14)
    return state((adx > 25) & (pdi > mdi), (adx < 20) | (pdi < mdi), (adx > 25) & (mdi > pdi), (adx < 20) | (mdi < pdi))


def bb_breakout(d):
    c = d["c"]
    m, sd = sma(c, 20), pd.Series(c).rolling(20).std(ddof=0).values
    return state(c > m + 2 * sd, c < m, c < m - 2 * sd, c > m)


def bb_reversion(d):
    c = d["c"]
    m, sd = sma(c, 20), pd.Series(c).rolling(20).std(ddof=0).values
    return state(c < m - 2 * sd, c > m, c > m + 2 * sd, c < m)


def macd(d):
    c = d["c"]
    line = ema(c, 12) - ema(c, 26)
    sig = ema(line, 9)
    e200 = ema(c, 200)
    return state((line > sig) & (c > e200), line < sig, (line < sig) & (c < e200), line > sig)


def roc(d, n):
    c = d["c"]
    r = c / np.r_[np.full(n, np.nan), c[:-n]] - 1
    return np.where(r > 0, 1.0, np.where(r < 0, -1.0, 0.0))


def ema_cross(d, fast, slow):
    c = d["c"]
    return np.where(ema(c, fast) > ema(c, slow), 1.0, -1.0)


def sma_trend(d, n=200):
    c = d["c"]
    return np.where(c > sma(c, n), 1.0, 0.0)


def ichimoku(d):
    h, l, c = d["h"], d["l"], d["c"]
    tk, kj = (roll_max(h, 9) + roll_min(l, 9)) / 2, (roll_max(h, 26) + roll_min(l, 26)) / 2
    a = np.r_[np.full(26, np.nan), ((tk + kj) / 2)[:-26]]
    b = np.r_[np.full(26, np.nan), ((roll_max(h, 52) + roll_min(l, 52)) / 2)[:-26]]
    top, bot = np.fmax(a, b), np.fmin(a, b)
    return state((c > top) & (tk > kj), c < kj, (c < bot) & (tk < kj), c > kj)


def supertrend(d, n=10, mult=3.0):
    h, l, c = d["h"], d["l"], d["c"]
    a = atr(h, l, c, n)
    hl2 = (h + l) / 2
    ub, lb = hl2 + mult * a, hl2 - mult * a
    fu, fl = ub.copy(), lb.copy()
    dirn = np.ones(len(c))
    for i in range(1, len(c)):
        fu[i] = ub[i] if (ub[i] < fu[i - 1] or c[i - 1] > fu[i - 1]) else fu[i - 1]
        fl[i] = lb[i] if (lb[i] > fl[i - 1] or c[i - 1] < fl[i - 1]) else fl[i - 1]
        if dirn[i - 1] == 1 and c[i] < fl[i]:
            dirn[i] = -1
        elif dirn[i - 1] == -1 and c[i] > fu[i]:
            dirn[i] = 1
        else:
            dirn[i] = dirn[i - 1]
    dirn[:n] = 0
    return dirn


def connors_rsi2(d):
    c = d["c"]
    r, s200, s5 = rsi(c, 2), sma(c, 200), sma(c, 5)
    return state((c > s200) & (r < 10), c > s5, (c < s200) & (r > 90), c < s5)


def rsi_reversion(d):
    r = rsi(d["c"], 14)
    return state(r < 30, r > 50, r > 70, r < 50)


def buy_hold(d):
    return np.ones(len(d["c"]))


STRATS = {
    "Buy&Hold": buy_hold,
    "SMA200 тренд (long/flat)": sma_trend,
    "EMA50/200 golden cross": lambda d: ema_cross(d, 50, 200),
    "EMA20/50 cross": lambda d: ema_cross(d, 20, 50),
    "Turtle 55/20": lambda d: turtle(d, 55, 20),
    "Turtle 20/10": lambda d: turtle(d, 20, 10),
    "Supertrend 10/3": supertrend,
    "ADX trend rider": adx_rider,
    "Bollinger breakout": bb_breakout,
    "MACD+EMA200": macd,
    "Momentum ROC(30д)": None,   # зависит от ТФ, см. survey.py
    "Momentum ROC(90д)": None,
    "Ichimoku": ichimoku,
    "Connors RSI-2": connors_rsi2,
    "Bollinger reversion": bb_reversion,
    "RSI(14) reversion": rsi_reversion,
}


# ───────────────────────── движок ─────────────────────────
def backtest(d, s, start, end, bars_per_year, fee=0.0004, slip=0.0001):
    """Позиция s[i-1] держится в баре i (вход по open[i]). Возвращает метрики и ряд эквити."""
    o, c = d["o"], d["c"]
    cost = fee + slip
    eq = 1.0
    curve = np.empty(end - start)
    trades = []
    entry_eq = None
    in_bars = 0
    for k, i in enumerate(range(start, end)):
        before = s[i - 2] if i >= 2 else 0.0
        hold = s[i - 1] if i >= 1 else 0.0
        if np.isnan(before): before = 0.0
        if np.isnan(hold): hold = 0.0
        eq *= 1 + before * (o[i] / c[i - 1] - 1)
        if hold != before:
            if before != 0 and entry_eq is not None:
                eq *= 1 - cost                          # выход
                trades.append(eq / entry_eq - 1)
                entry_eq = None
            if hold != 0:
                entry_eq = eq
                eq *= 1 - cost                          # вход
        eq *= 1 + hold * (c[i] / o[i] - 1)
        if hold != 0:
            in_bars += 1
        curve[k] = eq
    n = len(curve)
    rets = np.diff(np.r_[1.0, curve]) / np.r_[1.0, curve[:-1]]
    peak = np.maximum.accumulate(curve)
    dd = ((peak - curve) / peak).max() * 100
    years = n / bars_per_year
    t = np.array(trades) if trades else np.zeros(0)
    gp, gl = t[t > 0].sum(), -t[t <= 0].sum()
    return dict(ret=(curve[-1] - 1) * 100, cagr=(curve[-1] ** (1 / years) - 1) * 100 if years > 0 else 0.0,
                dd=dd, sharpe=rets.mean() / rets.std() * np.sqrt(bars_per_year) if rets.std() > 0 else 0.0,
                trades=len(t), wr=100 * float((t > 0).mean()) if len(t) else 0.0,
                pf=gp / gl if gl > 0 else (float("inf") if gp > 0 else 0.0),
                expo=100 * in_bars / n, curve=curve)
