"""Движок внутридневных стратегий.

Стратегия отдаёт планы {i: Plan}: план ставится по закрытию бара i и действует с бара i+1.
Ордер плана: market (по open следующего бара), stop (пробой уровня), limit (откат к уровню).
Выходы: SL (stop-market, Taker + проскальзывание), TP (лимитка, Maker), тайм-стоп (по open, Taker + проскальзывание).
Внутри бара путь цены по эвристике TradingView (open ближе к high: O-H-L-C, иначе O-L-H-C); при входе и SL в одном
баре стоп считается сработавшим. Размер: риск risk * капитал / расстояние до SL (плечо <= lev);
без SL (временные стратегии) - позиция = 1x капитала.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

COSTS = {
    "gross": dict(taker=0.0, maker=0.0, slip=0.0),
    "real": dict(taker=0.0004, maker=0.0002, slip=0.0001),    # Binance Futures: Taker 0.04%, Maker 0.02%, slip 0.01%
    "maker": dict(taker=0.0002, maker=0.0002, slip=0.0),      # оптимистично: всё лимитками без проскальзывания
}


@dataclass
class Order:
    side: int
    etype: str                  # 'm' market | 's' stop | 'l' limit
    px: float | None
    sl: float | None
    tp: float | None


@dataclass
class Plan:
    orders: list = field(default_factory=list)
    valid_until: int = 0        # последний бар, в котором ордер ещё действует
    hold: int | None = None     # макс. баров в позиции
    exit_at: int | None = None  # индекс бара, по open которого выходим принудительно


def simulate(o, h, l, c, plans, cost, start=0, end=None, risk=0.01, lev=5.0):
    taker, maker, slip = cost["taker"], cost["maker"], cost["slip"]
    n = len(c)
    end = n if end is None else end
    eq = peak = 1.0
    mdd = 0.0
    pos = 0
    entry = qty = sl = tp = efee = risk_usd = 0.0
    ent_i = 0
    hold = exit_at = None
    sl_set = tp_set = False
    pend = None
    trades = []
    curve = np.empty(end - start)

    def close_pos(i, ex, rate, kind):
        nonlocal eq, pos, qty
        fees = efee + qty * ex * rate
        pnl = pos * (ex - entry) * qty - fees
        eq += pnl
        trades.append((i, pos, pnl, pnl / risk_usd if risk_usd else 0.0, fees / risk_usd if risk_usd else 0.0, kind))
        pos, qty = 0, 0.0

    for i in range(start, end):
        o_, h_, l_, c_ = o[i], h[i], l[i], c[i]
        if pos and ((hold is not None and i - ent_i >= hold) or (exit_at is not None and i >= exit_at)):
            close_pos(i, o_ * (1 - slip * pos), taker, "time")
        if pend is not None and i > pend.valid_until:
            pend = None
        if pend is not None or pos:
            pts = (o_, h_, l_, c_) if abs(h_ - o_) < abs(l_ - o_) else (o_, l_, h_, c_)
            filled = None
            if pend is not None:                                   # исполнение по open (market / гэп)
                for od in pend.orders:
                    if od.etype == "m":
                        filled = (od, o_)
                    elif od.etype == "s" and ((od.side == 1 and o_ >= od.px) or (od.side == -1 and o_ <= od.px)):
                        filled = (od, o_)
                    elif od.etype == "l" and ((od.side == 1 and o_ <= od.px) or (od.side == -1 and o_ >= od.px)):
                        filled = (od, o_)
                    if filled:
                        break
            for a, b in ((pts[0], pts[1]), (pts[1], pts[2]), (pts[2], pts[3])):
                start_p = a
                if pos == 0 and pend is not None:
                    if filled is None:
                        for od in pend.orders:
                            px = od.px
                            if od.etype == "s" and ((od.side == 1 and a < px <= b) or (od.side == -1 and a > px >= b)):
                                filled, start_p = (od, px), px
                            elif od.etype == "l" and ((od.side == 1 and a > px >= b) or (od.side == -1 and a < px <= b)):
                                filled, start_p = (od, px), px
                            if filled:
                                break
                    if filled is not None:
                        od, base = filled
                        side = od.side
                        rate = maker if od.etype == "l" else taker
                        px_in = base if od.etype == "l" else base * (1 + slip * side)
                        dist = abs(px_in - od.sl) if od.sl is not None else None
                        if dist is not None and dist <= 0:
                            filled = None
                            pend = None
                            continue
                        if dist is not None:
                            q = eq * risk / dist
                            risk_usd = eq * risk
                        else:
                            q = eq / px_in
                            risk_usd = eq * 0.01          # условный "R" = 1% капитала для временных стратегий
                        q = min(q, eq * lev / px_in)
                        pos, entry, qty = side, px_in, q
                        sl, tp = od.sl, od.tp
                        efee = qty * entry * rate
                        ent_i, hold, exit_at = i, pend.hold, pend.exit_at
                        pend = None
                if pos == 0:
                    continue
                ex = kind = None
                if pos == 1:
                    if sl is not None and b < start_p and b <= sl:
                        ex, kind, rate = min(o_, sl) * (1 - slip), "sl", taker
                    elif tp is not None and b > start_p and b >= tp:
                        ex, kind, rate = max(o_, tp) if o_ >= tp else tp, "tp", maker
                else:
                    if sl is not None and b > start_p and b >= sl:
                        ex, kind, rate = max(o_, sl) * (1 + slip), "sl", taker
                    elif tp is not None and b < start_p and b <= tp:
                        ex, kind, rate = min(o_, tp) if o_ <= tp else tp, "tp", maker
                if ex is not None:
                    close_pos(i, ex, rate, kind)
                    break
        mtm = eq + (pos * (c_ - entry) * qty - efee if pos else 0.0)
        if mtm > peak:
            peak = mtm
        d = (peak - mtm) / peak
        if d > mdd:
            mdd = d
        curve[i - start] = mtm
        exits_next = pos != 0 and ((exit_at is not None and i + 1 >= exit_at) or (hold is not None and i + 1 - ent_i >= hold))
        if (pos == 0 or exits_next) and pend is None and i in plans and i + 1 < end:
            pend = plans[i]                       # позиция, закрывающаяся по времени на следующем open, не блокирует новый план
    return trades, curve, mdd * 100


def summarize(trades, curve, mdd, bars_per_day):
    n = len(trades)
    days = len(curve) / bars_per_day
    if n == 0:
        return dict(trades=0, wr=0.0, avgR=0.0, t=0.0, pf=0.0, net=0.0, dd=mdd, tpd=0.0, feeR=0.0)
    pnl = np.array([t[2] for t in trades])
    r = np.array([t[3] for t in trades])
    gp, gl = pnl[pnl > 0].sum(), -pnl[pnl <= 0].sum()
    return dict(trades=n, wr=100 * float((pnl > 0).mean()), avgR=float(r.mean()),
                t=float(r.mean() / (r.std(ddof=1) / np.sqrt(n))) if n > 2 and r.std() > 0 else 0.0,
                pf=gp / gl if gl > 0 else (float("inf") if gp > 0 else 0.0), net=(curve[-1] - 1) * 100, dd=mdd,
                tpd=n / days, feeR=float(np.mean([t[4] for t in trades])))
