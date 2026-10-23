"""Трендследящая стратегия: пробой канала Дончиана + стоп ATR (Chandelier trailing) + опциональный выход по каналу.

Вход: стоп-ордер на границе канала предыдущих n баров (исполнение по уровню, при гэпе - по open).
Стоп: entry -/+ m * ATR на момент входа, далее трейлинг от экстремума с момента входа.
Размер: риск % капитала / расстояние до стопа, потолок плеча lev. Комиссия Taker + проскальзывание на каждом входе/выходе.
Внутри бара при входе и стопе в одном баре консервативно считаем, что стоп сработал.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import numpy as np
import pandas as pd

DATA = os.environ.get("BT_DATA", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"))


@dataclass(frozen=True)
class TCfg:
    n: int = 55            # канал входа, баров
    m: float = 3.0         # стоп = m * ATR
    atr_n: int = 14
    exit_n: int = 0        # 0 = только трейлинг; иначе дополнительно выход по каналу exit_n
    ema: int = 0           # 0 = без фильтра; иначе лонг только выше EMA(ema), шорт только ниже
    sides: str = "both"    # both | long | short
    risk: float = 0.02
    lev: float = 20.0
    fee: float = 0.0004    # Taker на сторону
    slip: float = 0.0001
    capital: float = 10_000.0


class TMarket:
    def __init__(self, sym, tf="4h", data=DATA):
        d = pd.read_csv(f"{data}/{sym}_{tf}.csv")
        self.t = d.t.values.astype("int64")
        self.df = d
        self.o, self.h, self.l, self.c = (d[k].values for k in "ohlc")
        self.tf_h = {"1h": 1, "4h": 4}[tf]
        self._cache = {}

    def ind(self, cfg):
        key = (cfg.n, cfg.atr_n, cfg.exit_n, cfg.ema)
        if key not in self._cache:
            h, l, c = pd.Series(self.h), pd.Series(self.l), pd.Series(self.c)
            tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
            atr = tr.ewm(alpha=1 / cfg.atr_n, adjust=False).mean().shift(1)           # ATR, известный на открытии бара
            hh, ll = h.rolling(cfg.n).max().shift(1), l.rolling(cfg.n).min().shift(1)
            xl = l.rolling(cfg.exit_n).min().shift(1) if cfg.exit_n else pd.Series(np.nan, index=h.index)
            xh = h.rolling(cfg.exit_n).max().shift(1) if cfg.exit_n else pd.Series(np.nan, index=h.index)
            if cfg.ema:
                e = c.ewm(span=cfg.ema, adjust=False).mean().shift(1)
                up, dn = (c.shift(1) > e), (c.shift(1) < e)
            else:
                up = dn = pd.Series(True, index=h.index)
            self._cache[key] = tuple(np.asarray(x) for x in (atr, hh, ll, xl, xh, up, dn))
        return self._cache[key]


def run(m, cfg=TCfg(), start=0, end=None, want_trades=False):
    atr, hh, ll, xl, xh, up, dn = m.ind(cfg)
    n = len(m.c)
    end = n if end is None else end
    start = max(start, cfg.n + cfg.atr_n + max(cfg.exit_n, cfg.ema) + 2)
    bal = peak = cfg.capital
    dd_pct = 0.0
    pos = 0
    entry = qty = stop = ext = risk_usd = efee = 0.0
    trades = []
    slip, fee, lev = cfg.slip, cfg.fee, cfg.lev
    can_long, can_short = cfg.sides in ("both", "long"), cfg.sides in ("both", "short")
    for i in range(start, end):
        o, h, l, c = m.o[i], m.h[i], m.l[i], m.c[i]
        a = atr[i]
        if pos == 0 and a == a:
            lg = can_long and up[i] and h >= hh[i]
            sh = can_short and dn[i] and l <= ll[i]
            if lg and sh:
                if abs(o - hh[i]) <= abs(o - ll[i]):
                    sh = False
                else:
                    lg = False
            if lg or sh:
                side = 1 if lg else -1
                lvl = hh[i] if lg else ll[i]
                base = max(o, lvl) if lg else min(o, lvl)
                entry = base * (1 + slip * side)
                dist = cfg.m * a
                stop = entry - side * dist
                q = bal * cfg.risk / dist
                q = min(q, bal * lev / entry)
                if q <= 0:
                    continue
                pos, qty, ext, risk_usd = side, q, (h if lg else l), q * dist
                efee = qty * entry * fee
                # тот же бар: стоп мог сработать после входа
                if (pos == 1 and l <= stop) or (pos == -1 and h >= stop):
                    ex = stop * (1 - slip * pos)
                    pnl = pos * (ex - entry) * qty - efee - qty * ex * fee
                    bal += pnl
                    trades.append((i, pos, pnl, pnl / risk_usd))
                    pos = 0
                    continue
        elif pos != 0:
            s = stop
            if pos == 1:
                if cfg.exit_n and xl[i] == xl[i]:
                    s = max(s, xl[i])
                if l <= s:
                    ex = min(o, s) * (1 - slip)
                    pnl = (ex - entry) * qty - efee - qty * ex * fee
                    bal += pnl
                    trades.append((i, 1, pnl, pnl / risk_usd))
                    pos = 0
                else:
                    ext = max(ext, h)
                    if a == a:
                        stop = max(stop, ext - cfg.m * a)
            else:
                if cfg.exit_n and xh[i] == xh[i]:
                    s = min(s, xh[i])
                if h >= s:
                    ex = max(o, s) * (1 + slip)
                    pnl = (entry - ex) * qty - efee - qty * ex * fee
                    bal += pnl
                    trades.append((i, -1, pnl, pnl / risk_usd))
                    pos = 0
                else:
                    ext = min(ext, l)
                    if a == a:
                        stop = min(stop, ext + cfg.m * a)
        eq = bal + (pos * (c - entry) * qty - efee if pos else 0.0)
        peak = max(peak, eq)
        dd_pct = max(dd_pct, (peak - eq) / peak * 100)
    pnls = np.array([t[2] for t in trades]) if trades else np.zeros(0)
    rs = np.array([t[3] for t in trades]) if trades else np.zeros(0)
    gp, gl = pnls[pnls > 0].sum(), -pnls[pnls <= 0].sum()
    res = dict(trades=len(trades), winrate=100 * float((pnls > 0).mean()) if len(pnls) else 0.0,
               net_pct=(bal - cfg.capital) / cfg.capital * 100, dd_pct=dd_pct,
               pf=gp / gl if gl > 0 else (float("inf") if gp > 0 else 0.0), avg_R=float(rs.mean()) if len(rs) else 0.0)
    if want_trades:
        res["_trades"] = trades
    return res
