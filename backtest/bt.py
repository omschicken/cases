"""Бэктест пробойной стратегии горизонтальных уровней (уровни 1h, тренд EMA20 4h, вход на ТФ графика).

Порт level_breakout_mtf.pine. Подготовка данных векторизована (pandas/numpy), состояние сделок -
узкий цикл по барам со скалярами.

Чистый R сделки (на единицу номинала входа, s = |entry - SL| / entry, f_* - комиссия в долях):
    TP:  R = RR - (f_in + f_tp * (1 + RR * s)) / s
    SL:  R = -1 - (f_in + f_sl * (1 - s)) / s
Комиссия "съедает" примерно (f_in + f_out) / s от риска: чем шире стоп, тем она меньше.
Безубыточный винрейт: p* = (1 + b) / (RR + 1 + b - a),  a = (f_in + f_tp) / s,  b = (f_in + f_sl) / s.
"""
from __future__ import annotations

import bisect
import os
from dataclasses import dataclass, replace

import numpy as np
import pandas as pd

DATA = os.environ.get("BT_DATA", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"))


@dataclass(frozen=True)
class Cfg:
    # поиск уровней (зафиксированный кластер XRP 15m)
    N: int = 300             # окно поиска уровня, свечей 1h
    M: int = 5               # мин. расстояние между касаниями, свечей 1h
    K: int = 12              # окно стопа, свечей ТФ графика
    L: int = 3               # пивоты слева
    R: int = 3               # пивоты справа
    tol: float = 0.0005      # погрешность касания (0.05%)
    min_touches: int = 2
    # риск
    minSlPct: float = 0.005  # мин. размер стопа (0.5%), меньшие сделки пропускаются
    maxSlPct: float = 0.0    # макс. размер стопа (доля); 0 = выкл. Защита от "вечных" сделок с гигантским SL/TP
    max_hold: int = 0        # тайм-стоп, баров ТФ графика; 0 = выкл. (закрытие по рынку, комиссия как у SL)
    risk: float = 0.02
    rr: float = 3.0
    lev: float = 20.0
    capital: float = 10_000.0
    skip_over: bool = True
    one_per_level: bool = True
    allow_long: bool = True
    allow_short: bool = True
    # исполнение и комиссии (доли от номинала)
    entry_mode: str = "limit"   # "limit": Maker по цене уровня; "stop": Buy/Sell Stop (Taker), гэп - по open
    fee_entry: float = 0.0002   # 0.02% Maker
    fee_tp: float = 0.0002      # TP - лимитка, Maker
    fee_sl: float = 0.0002      # SL: по ТЗ 0.02%; реалистично stop-market = Taker 0.0004
    slip: float = 0.0           # проскальзывание stop-входа и SL (доля цены)


# Сценарии исполнения для сравнения
PROFILES = {
    # п.3 ТЗ: лимитный вход по уровню (0.02%), выход 0.02%  -> круг 0.04%. Оптимистичная верхняя граница.
    "limit_spec": dict(entry_mode="limit", fee_entry=0.0002, fee_tp=0.0002, fee_sl=0.0002),
    # п.1 ТЗ: вход Taker 0.04% + выход Maker 0.02%  -> круг 0.06%, вход по stop-ордеру
    "stop_spec": dict(entry_mode="stop", fee_entry=0.0004, fee_tp=0.0002, fee_sl=0.0002),
    # реалистично для Binance Futures: stop-вход и SL - Taker (0.04%), TP - Maker, slip 0.01%
    "stop_real": dict(entry_mode="stop", fee_entry=0.0004, fee_tp=0.0002, fee_sl=0.0004, slip=0.0001),
}


def profile(name, **kw):
    return replace(Cfg(), **{**PROFILES[name], **kw})


def net_r(kind, s, rr, f_in, f_tp, f_sl):
    """Чистый R по формуле из docstring (без проскальзывания)."""
    if kind == "tp":
        return rr - (f_in + f_tp * (1 + rr * s)) / s
    return -1 - (f_in + f_sl * (1 - s)) / s


def breakeven_wr(s, rr, f_in, f_tp, f_sl):
    a, b = (f_in + f_tp) / s, (f_in + f_sl) / s
    return (1 + b) / (rr + 1 + b - a)


def _read(sym, iv, data):
    df = pd.read_csv(f"{data}/{sym}_{iv}.csv")
    df.index = pd.to_datetime(df.t, unit="ms")
    return df


class Market:
    def __init__(self, sym, tf=15, data=DATA):
        self.sym, self.tf = sym, tf
        if os.path.exists(f"{data}/{sym}_{tf}m.csv"):
            d = _read(sym, f"{tf}m", data)
        else:  # ресэмплинг из 5m
            d = _read(sym, "5m", data).resample(f"{tf}min", label="left", closed="left").agg(
                {"t": "first", "o": "first", "h": "max", "l": "min", "c": "last", "v": "sum"}).dropna().iloc[1:]
        self.df = d
        self.t = d.t.values.astype("int64")
        self.hi, self.lo = d.h.values, d.l.values
        self.o, self.h, self.l, self.c = (d[k].values.tolist() for k in "ohlc")
        h1, h4 = _read(sym, "1h", data), _read(sym, "4h", data)
        self.h1_t, self.h1_h, self.h1_l = h1.t.values.astype("int64"), h1.h.values, h1.l.values
        ema4 = h4.c.ewm(span=20, adjust=False).mean().values
        # последняя ЗАКРЫТАЯ 1h свеча / EMA последней закрытой 4h свечи (как [1] + lookahead_on в Pine)
        self.cur = np.searchsorted(self.h1_t, self.t, side="right") - 2
        k4 = np.searchsorted(h4.t.values.astype("int64"), self.t, side="right") - 2
        self.ema = np.where(k4 >= 0, ema4[np.clip(k4, 0, None)], np.nan).tolist()
        self._ext, self._piv, self._lv = {}, {}, {}

    def start_index(self, days):
        return int(np.searchsorted(self.t, self.t[0] + days * 86400 * 1000))

    def ext(self, K):
        if K not in self._ext:
            self._ext[K] = (pd.Series(self.lo).rolling(K).min().values.tolist(),
                            pd.Series(self.hi).rolling(K).max().values.tolist())
        return self._ext[K]

    def pivots(self, L, R):
        """Векторизованный ta.pivothigh/pivotlow по 1h: слева строго больше, справа не меньше."""
        if (L, R) not in self._piv:
            out = []
            for x, sign in ((self.h1_h, 1), (-self.h1_l, -1)):
                s = pd.Series(x)
                left = s.rolling(L).max().shift(1)
                right = s[::-1].rolling(R).max()[::-1].shift(-1)
                idx = np.flatnonzero(((s > left) & (s >= right)).values)
                out.append((idx, sign * x[idx]))
            self._piv[(L, R)] = out
        return self._piv[(L, R)]

    def levels(self, cfg):
        """Уровни пересчитываются только в моменты событий (подтверждение пивота / выход из окна N)."""
        key = (cfg.N, cfg.M, cfg.L, cfg.R, cfg.tol, cfg.min_touches)
        if key in self._lv:
            return self._lv[key]
        piv = self.pivots(cfg.L, cfg.R)
        ev = np.unique(np.concatenate([idx + off for idx, _ in piv for off in (cfg.R, cfg.N + 1)]))
        ev = ev[(ev >= 0) & (ev <= self.cur.max())]
        levs = []
        for ci in ev:
            sides = []
            for idx, pr in piv:
                lo = np.searchsorted(idx, ci - cfg.N, "left")
                hi = np.searchsorted(idx, ci - cfg.R, "right")
                ii, pp = idx[lo:hi], pr[lo:hi]
                lv = []
                if len(pp) >= cfg.min_touches:
                    for k in range(len(pp)):
                        mask = np.abs(pp - pp[k]) / pp[k] <= cfg.tol
                        s_, c_, last = 0.0, 0, -10 ** 9
                        for q, qi in zip(pp[mask], ii[mask]):
                            if qi - last >= cfg.M:
                                c_ += 1
                                s_ += q
                                last = qi
                        if c_ >= cfg.min_touches:
                            lv.append(s_ / c_)
                sides.append(sorted(lv))
            levs.append((sides[0], sides[1]))   # (сопротивления, поддержки)
        self._lv[key] = (ev, levs)
        return self._lv[key]


def _near(lv, ref, used, tol, above):
    if above:
        i = bisect.bisect_right(lv, ref)
        while i < len(lv):
            if used is None or abs(lv[i] - used) / lv[i] > tol:
                return lv[i]
            i += 1
    else:
        i = bisect.bisect_left(lv, ref) - 1
        while i >= 0:
            if used is None or abs(lv[i] - used) / lv[i] > tol:
                return lv[i]
            i -= 1
    return None


def _has(lv, x, tol):
    return x is not None and any(abs(v - x) / x <= tol for v in lv)


def run(m, cfg=Cfg(), start=0, end=None, want_trades=False):
    ev, levs = m.levels(cfg)
    kk = (np.searchsorted(ev, m.cur, "right") - 1).tolist()
    minlow, maxhigh = m.ext(cfg.K)
    n = len(m.c)
    end = n if end is None else end
    tol, limit, slip = cfg.tol, cfg.entry_mode == "limit", cfg.slip
    bal = peak = cfg.capital
    dd_usd = dd_pct = 0.0
    pos = 0
    entry = qty = sl = tp = entry_fee = cur_risk = sl_frac = 0.0
    ent_i = 0
    pend = None
    used = {1: None, -1: None}
    prev_k = -2
    trades = []
    for i in range(start, end):
        o, h, l, c = m.o[i], m.h[i], m.l[i], m.c[i]
        # ---- исполнение внутри бара (путь цены по эвристике TradingView) ----
        if pend is not None or pos:
            pts = (o, h, l, c) if abs(h - o) < abs(l - o) else (o, l, h, c)
            fill_at = None
            if pend is not None:
                p_side, lvl = pend[0], pend[1]
                if (p_side == 1 and o >= lvl) or (p_side == -1 and o <= lvl):   # гэп через уровень
                    if limit:
                        pend = None          # цена уже за уровнем: лимитка не исполняется
                    else:
                        fill_at = o
            for a, b in ((pts[0], pts[1]), (pts[1], pts[2]), (pts[2], pts[3])):
                start_p = a
                if pos == 0 and pend is not None:
                    if fill_at is None and ((p_side == 1 and a < lvl <= b) or (p_side == -1 and a > lvl >= b)):
                        fill_at = lvl
                        start_p = lvl
                    if fill_at is not None:
                        pos = p_side
                        entry = fill_at if limit else fill_at * (1 + slip * pos)
                        qty, sl, tp, cur_risk, sl_frac = pend[2], pend[3], pend[4], pend[5], pend[6]
                        entry_fee = qty * entry * cfg.fee_entry
                        ent_i = i
                        if cfg.one_per_level:
                            used[pos] = lvl
                        pend = None
                if pos == 0:
                    continue
                ex = kind = None
                if pos == 1:
                    if b < start_p and b <= sl:
                        ex, kind = sl * (1 - slip), "sl"
                    elif b > start_p and b >= tp:
                        ex, kind = tp, "tp"
                else:
                    if b > start_p and b >= sl:
                        ex, kind = sl * (1 + slip), "sl"
                    elif b < start_p and b <= tp:
                        ex, kind = tp, "tp"
                if ex is not None:
                    rate = cfg.fee_tp if kind == "tp" else cfg.fee_sl
                    fees = entry_fee + qty * ex * rate
                    pnl = pos * (ex - entry) * qty - fees
                    bal += pnl
                    trades.append((i, pos, pnl, pnl / cur_risk if cur_risk else 0.0, sl_frac, kind, fees, cur_risk, ent_i))
                    pos, qty = 0, 0.0
                    break
        if pos and cfg.max_hold and i - ent_i >= cfg.max_hold:     # тайм-стоп по закрытию бара
            ex = c * (1 - slip * pos)
            fees = entry_fee + qty * ex * cfg.fee_sl
            pnl = pos * (ex - entry) * qty - fees
            bal += pnl
            trades.append((i, pos, pnl, pnl / cur_risk if cur_risk else 0.0, sl_frac, "time", fees, cur_risk, ent_i))
            pos, qty = 0, 0.0
        pend = None
        # ---- эквити / просадка ----
        eq = bal + (pos * (c - entry) * qty - entry_fee if pos else 0.0)
        if eq > peak:
            peak = eq
        d = peak - eq
        if d > dd_usd:
            dd_usd = d
        if d / peak * 100 > dd_pct:
            dd_pct = d / peak * 100
        # ---- обновление набора уровней ----
        k = kk[i]
        if k != prev_k:
            prev_k = k
            if k >= 0:
                if used[1] is not None and not _has(levs[k][0], used[1], tol):
                    used[1] = None
                if used[-1] is not None and not _has(levs[k][1], used[-1], tol):
                    used[-1] = None
        # ---- постановка ордера на следующий бар ----
        if pos or i >= end - 1 or k < 0:
            continue
        ema = m.ema[i]
        if ema != ema:
            continue
        if c > ema and cfg.allow_long:
            lv = _near(levs[k][0], c, used[1], tol, True)
            side = 1
        elif c < ema and cfg.allow_short:
            lv = _near(levs[k][1], c, used[-1], tol, False)
            side = -1
        else:
            continue
        if lv is None:
            continue
        slp = minlow[i] if side == 1 else maxhigh[i]
        dist = (lv - slp) * side
        frac = dist / lv
        if dist <= 0 or frac < cfg.minSlPct:      # жёсткий фильтр: слишком узкий стоп - пропускаем
            continue
        if cfg.maxSlPct and frac > cfg.maxSlPct:  # слишком широкий стоп - пропускаем
            continue
        vol = bal * cfg.risk / frac              # Объём = (Баланс * риск) / SL%
        if vol > bal * cfg.lev:
            if cfg.skip_over:
                continue
            vol = bal * cfg.lev
        q = vol / lv
        pend = (side, lv, q, slp, lv + side * cfg.rr * dist, q * dist, frac)
    res = stats(trades, cfg.capital, bal, dd_usd, dd_pct, m.tf)
    if want_trades:
        res["_trades"] = trades
    return res


def stats(trades, capital, bal, dd_usd, dd_pct, tf_min=15):
    n = len(trades)
    pnl = np.array([t[2] for t in trades]) if n else np.zeros(0)
    r = np.array([t[3] for t in trades]) if n else np.zeros(0)
    win = pnl > 0
    streak = mx = 0
    for w in win:
        streak = 0 if w else streak + 1
        mx = max(mx, streak)
    gp, gl = pnl[win].sum(), -pnl[~win].sum()
    return dict(trades=n, winrate=100 * win.mean() if n else 0.0, net=bal - capital,
                net_pct=(bal - capital) / capital * 100, dd_usd=dd_usd, dd_pct=dd_pct,
                max_loss_streak=mx, pf=gp / gl if gl > 0 else (float("inf") if gp > 0 else 0.0),
                avg_R=float(r.mean()) if n else 0.0,
                avg_sl_pct=100 * float(np.mean([t[4] for t in trades])) if n else 0.0,
                tp_rate=100 * float(np.mean([t[5] == "tp" for t in trades])) if n else 0.0,
                max_hold_days=float(max(t[0] - t[8] for t in trades)) * tf_min / 1440 if n else 0.0,
                fee_R=float(np.mean([t[6] / t[7] for t in trades])) if n else 0.0,
                longs=sum(t[1] == 1 for t in trades), shorts=sum(t[1] == -1 for t in trades))


def by_period(m, trades, freq="6MS"):
    """Разбивка сделок по календарным периодам (по времени закрытия) - проверка стабильности по фазам рынка."""
    if not trades:
        return pd.DataFrame()
    df = pd.DataFrame(trades, columns="i side pnl R sl kind fees risk ent".split())
    df["ts"] = pd.to_datetime(m.t[df.i.values], unit="ms")
    out = []
    for per, g in df.groupby(pd.Grouper(key="ts", freq=freq)):
        if g.empty:
            continue
        gp, gl = g.pnl[g.pnl > 0].sum(), -g.pnl[g.pnl <= 0].sum()
        out.append(dict(period=per.strftime("%Y-%m"), trades=len(g), winrate=100 * (g.pnl > 0).mean(),
                        sumR=g.R.sum(), avgR=g.R.mean(), pf=gp / gl if gl else float("inf")))
    return pd.DataFrame(out)
