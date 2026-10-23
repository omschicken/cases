"""Построители планов для популярных внутридневных / скальпинговых стратегий (стандартные параметры).

df: DataFrame с колонками t (мс), o, h, l, c, v; tf - минуты бара. Время - UTC.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import strategies as S
from intraday import Order, Plan


class Ctx:
    def __init__(self, df, tf):
        self.tf = tf
        self.t = df.t.values.astype("int64")
        self.o, self.h, self.l, self.c, self.v = (df[k].values for k in "ohlcv")
        ts = pd.to_datetime(self.t, unit="ms")
        self.mod = (ts.hour.values * 60 + ts.minute.values)
        self.day = ts.normalize().values
        self.n = len(self.c)
        self.bpd = 1440 // tf
        self.atr = S.atr(self.h, self.l, self.c, 14)
        tp = (self.h + self.l + self.c) / 3
        g = pd.Series(self.day)
        self.vwap = (pd.Series(tp * self.v).groupby(g).cumsum() / pd.Series(self.v).groupby(g).cumsum()).values

    def contiguous(self, i0, i1):
        return i1 < self.n and self.t[i1] - self.t[i0] == (i1 - i0) * self.tf * 60_000


def _market(side, sl, tp):
    return Order(side, "m", None, sl, tp)


def orb(x: Ctx, start_min, range_min, rr, session_hours=8, min_w=0.001):
    """Opening range breakout: диапазон первых range_min минут сессии, пробой в любую сторону, SL = противоположный край."""
    k, plans = max(1, range_min // x.tf), {}
    sess = session_hours * 60 // x.tf
    for i0 in np.flatnonzero(x.mod == start_min):
        i1 = i0 + k - 1
        if not x.contiguous(i0, i1 + 1):
            continue
        hi, lo = x.h[i0:i1 + 1].max(), x.l[i0:i1 + 1].min()
        w = hi - lo
        if w / hi < min_w:
            continue
        plans[i1] = Plan([Order(1, "s", hi, lo, hi + rr * w), Order(-1, "s", lo, hi, lo - rr * w)],
                         valid_until=i0 + sess, exit_at=i0 + sess)
    return plans


def vwap_reversion(x: Ctx, kz=2.0, rr_min=0.002, hold_bars=None):
    """Возврат к VWAP: отклонение > kz * sigma (по 8 ч), SL = 1 sigma дальше, TP = VWAP."""
    dev = x.c - x.vwap
    sd = pd.Series(dev).rolling(8 * 60 // x.tf).std().values
    z = dev / sd
    hold = hold_bars or 3 * 60 // x.tf
    plans = {}
    for i in np.flatnonzero((x.mod >= 120) & (np.abs(z) > kz)):
        if np.isnan(sd[i]) or i + 2 >= x.n:
            continue
        side = 1 if z[i] < 0 else -1
        if abs(x.vwap[i] - x.c[i]) / x.c[i] < rr_min:
            continue
        sl = x.c[i] - side * sd[i]
        plans[i] = Plan([_market(side, sl, x.vwap[i])], valid_until=i + 1, hold=hold)
    return plans


def trend_pullback(x: Ctx, rr=2.0, min_sl=0.0015):
    """Откат к EMA21 в тренде (EMA200 + VWAP): свеча коснулась EMA21 и закрылась по тренду."""
    e21, e200 = S.ema(x.c, 21), S.ema(x.c, 200)
    lo6, hi6 = S.roll_min(x.l, 6), S.roll_max(x.h, 6)
    plans = {}
    for i in range(210, x.n - 2):
        if x.c[i] > e200[i] and x.c[i] > x.vwap[i] and x.l[i] <= e21[i] < x.c[i]:
            side, sl = 1, lo6[i]
        elif x.c[i] < e200[i] and x.c[i] < x.vwap[i] and x.h[i] >= e21[i] > x.c[i]:
            side, sl = -1, hi6[i]
        else:
            continue
        d = abs(x.c[i] - sl)
        if d / x.c[i] < min_sl:
            continue
        plans[i] = Plan([_market(side, sl, x.c[i] + side * rr * d)], valid_until=i + 1, hold=48 * 5 // x.tf)
    return plans


def ema_cross(x: Ctx, rr=2.0, adx_min=25, atr_mult=1.5):
    """EMA9/21 кросс + ADX > 25 + фильтр EMA200; SL = 1.5 ATR, TP = 2R."""
    e9, e21, e200 = S.ema(x.c, 9), S.ema(x.c, 21), S.ema(x.c, 200)
    adx, _, _ = S.adx_di(x.h, x.l, x.c, 14)
    plans = {}
    for i in range(210, x.n - 2):
        up = e9[i] > e21[i] and e9[i - 1] <= e21[i - 1]
        dn = e9[i] < e21[i] and e9[i - 1] >= e21[i - 1]
        if adx[i] < adx_min or not (up or dn):
            continue
        side = 1 if up else -1
        if (side == 1 and x.c[i] < e200[i]) or (side == -1 and x.c[i] > e200[i]):
            continue
        d = atr_mult * x.atr[i]
        plans[i] = Plan([_market(side, x.c[i] - side * d, x.c[i] + side * rr * d)], valid_until=i + 1, hold=48 * 5 // x.tf)
    return plans


def sweep_reversal(x: Ctx, n_back=72, rr=2.0, min_sl=0.0015, max_sl=0.01):
    """Съём ликвидности: прокол экстремума последних n_back баров с возвратом закрытия внутрь диапазона."""
    ph, pl = S.sh(S.roll_max(x.h, n_back)), S.sh(S.roll_min(x.l, n_back))
    plans = {}
    for i in range(n_back + 2, x.n - 2):
        if x.l[i] < pl[i] and x.c[i] > pl[i]:
            side, sl = 1, x.l[i]
        elif x.h[i] > ph[i] and x.c[i] < ph[i]:
            side, sl = -1, x.h[i]
        else:
            continue
        d = abs(x.c[i] - sl)
        if not (min_sl <= d / x.c[i] <= max_sl):
            continue
        plans[i] = Plan([_market(side, sl, x.c[i] + side * rr * d)], valid_until=i + 1, hold=48 * 5 // x.tf)
    return plans


def donchian_scalp(x: Ctx, n_back=48, atr_mult=1.5, rr=2.0):
    """Импульсный пробой канала n_back баров по тренду EMA200."""
    e200 = S.ema(x.c, 200)
    hh, ll = S.sh(S.roll_max(x.h, n_back)), S.sh(S.roll_min(x.l, n_back))
    plans = {}
    for i in range(max(n_back, 210), x.n - 2):
        if x.c[i] > hh[i] and x.c[i] > e200[i]:
            side = 1
        elif x.c[i] < ll[i] and x.c[i] < e200[i]:
            side = -1
        else:
            continue
        d = atr_mult * x.atr[i]
        plans[i] = Plan([_market(side, x.c[i] - side * d, x.c[i] + side * rr * d)], valid_until=i + 1, hold=36 * 5 // x.tf)
    return plans


def squeeze_breakout(x: Ctx, rr=2.0):
    """Сжатие Боллинджера (ширина в нижних 20% за 200 баров) и закрытие за полосой; SL = средняя линия."""
    m = S.sma(x.c, 20)
    sd = pd.Series(x.c).rolling(20).std(ddof=0).values
    up, lo = m + 2 * sd, m - 2 * sd
    bw = (up - lo) / m
    q = pd.Series(bw).rolling(200).quantile(0.2).values
    plans = {}
    for i in range(220, x.n - 2):
        if not bw[i - 1] <= q[i - 1]:
            continue
        if x.c[i] > up[i]:
            side = 1
        elif x.c[i] < lo[i]:
            side = -1
        else:
            continue
        d = abs(x.c[i] - m[i])
        if d / x.c[i] < 0.001:
            continue
        plans[i] = Plan([_market(side, m[i], x.c[i] + side * rr * d)], valid_until=i + 1, hold=32 * 15 // x.tf)
    return plans


def hour_long(x: Ctx, start_h, end_h):
    """Лонг от start_h до end_h UTC (Quantpedia: 21:00 -> 23:00). Без SL, позиция 1x."""
    plans = {}
    span = (end_h - start_h) * 60 // x.tf
    for i0 in np.flatnonzero(x.mod == start_h * 60):
        if i0 < 1 or not x.contiguous(i0 - 1, i0 + span):
            continue
        plans[i0 - 1] = Plan([_market(1, None, None)], valid_until=i0, exit_at=i0 + span)
    return plans


def tod_momentum(x: Ctx, sig_start, sig_end, trade_start, trade_end):
    """Внутридневной импульс: знак доходности окна [sig_start, sig_end) задаёт направление сделки в [trade_start, trade_end)."""
    plans = {}
    if min(sig_end - sig_start, trade_end - trade_start) < x.tf:
        return plans
    span = (trade_end - trade_start) // x.tf
    for i0 in np.flatnonzero(x.mod == sig_start):
        j1 = i0 + (sig_end - sig_start) // x.tf
        k0 = i0 + (trade_start - sig_start) // x.tf
        if not x.contiguous(i0, k0 + span):
            continue
        r = x.c[j1 - 1] / x.o[i0] - 1
        if r == 0:
            continue
        side = 1 if r > 0 else -1
        plans[k0 - 1] = Plan([_market(side, None, None)], valid_until=k0, exit_at=k0 + span)
    return plans


def vol_breakout(x: Ctx, k=0.5, use_sl=True, long_only=False):
    """Волатильный пробой Ларри Вильямса: вход при выходе цены за open дня +/- k * диапазон вчерашнего дня, выход на открытии следующего."""
    plans = {}
    day = x.bpd
    for i0 in np.flatnonzero(x.mod == 0):
        if i0 < day or i0 + day > x.n or not x.contiguous(i0 - day, i0 + day - 1):
            continue
        base = x.c[i0 - 1]
        rng = x.h[i0 - day:i0].max() - x.l[i0 - day:i0].min()
        orders = [Order(1, "s", base + k * rng, base if use_sl else None, None)]
        if not long_only:
            orders.append(Order(-1, "s", base - k * rng, base if use_sl else None, None))
        plans[i0 - 1] = Plan(orders, valid_until=i0 + day - 1, exit_at=i0 + day)
    return plans


def pd_breakout(x: Ctx):
    """Пробой вчерашнего максимума/минимума; SL = середина вчерашнего диапазона; выход на открытии следующего дня."""
    plans = {}
    day = x.bpd
    for i0 in np.flatnonzero(x.mod == 0):
        if i0 < day or i0 + day > x.n or not x.contiguous(i0 - day, i0 + day - 1):
            continue
        hi, lo = x.h[i0 - day:i0].max(), x.l[i0 - day:i0].min()
        mid = (hi + lo) / 2
        plans[i0 - 1] = Plan([Order(1, "s", hi, mid, None), Order(-1, "s", lo, mid, None)],
                             valid_until=i0 + day - 1, exit_at=i0 + day)
    return plans


# (имя, ТФ минут, построитель)
def catalog():
    items = []
    for name, sm in (("00:00", 0), ("08:00", 480), ("13:30", 810)):
        for rng in (30, 60):
            for rr in (1.0, 2.0):
                items.append((f"ORB {name} диап.{rng}м RR{rr:g}", 5, lambda x, sm=sm, rng=rng, rr=rr: orb(x, sm, rng, rr)))
    items += [
        ("VWAP-возврат 2σ", 5, lambda x: vwap_reversion(x, 2.0)),
        ("VWAP-возврат 3σ", 5, lambda x: vwap_reversion(x, 3.0)),
        ("Откат к EMA21 по тренду", 5, trend_pullback),
        ("EMA9/21 кросс+ADX", 5, ema_cross),
        ("Sweep ликвидности 6ч", 5, lambda x: sweep_reversal(x, 72)),
        ("Sweep ликвидности 24ч", 5, lambda x: sweep_reversal(x, 288)),
        ("Пробой канала 4ч (скальп)", 5, lambda x: donchian_scalp(x, 48)),
        ("Пробой канала 12ч (скальп)", 5, lambda x: donchian_scalp(x, 144)),
        ("Squeeze Bollinger 15м", 15, squeeze_breakout),
        ("Лонг 21:00-23:00 UTC", 5, lambda x: hour_long(x, 21, 23)),
        ("Импульс 13:30-14:00 -> 20:30-21:00", 5, lambda x: tod_momentum(x, 810, 840, 1230, 1260)),
        ("Импульс 00:00-04:00 -> 04:00-08:00", 5, lambda x: tod_momentum(x, 0, 240, 240, 480)),
        ("Vol-пробой Вильямса k0.5 (SL=open)", 5, lambda x: vol_breakout(x, 0.5, True)),
        ("Vol-пробой Вильямса k0.5 (без SL)", 5, lambda x: vol_breakout(x, 0.5, False)),
        ("Vol-пробой Вильямса k1.0 (SL=open)", 5, lambda x: vol_breakout(x, 1.0, True)),
        ("Vol-пробой Вильямса k0.5 лонг (SL=open)", 5, lambda x: vol_breakout(x, 0.5, True, True)),
        ("Пробой вчерашнего H/L (SL=середина)", 5, pd_breakout),
    ]
    return items
