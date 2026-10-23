"""Event-study внутридневных идей: python intraday2.py <папка_5m_csv> [папка_5m_с_tb]

Для каждого сигнала считаем валовую доходность сделки (вход по open следующего бара, выход по close через h баров,
сделки не пересекаются) в б.п. и сравниваем с издержками круга: Taker 10 б.п. (0.04% + 0.01% slip на сторону), Maker 4 б.п.
Для парных сделок (две ноги) издержки удваиваются на единицу ноги.
"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SYMS = ["BTCUSDT", "ETHUSDT", "XRPUSDT"]
COST_TAKER, COST_MAKER = 10.0, 4.0


def load(data, extra=False):
    d = {}
    for s in SYMS:
        x = pd.read_csv(f"{data}/{s}_5m.csv")
        x.index = pd.to_datetime(x.t, unit="ms")
        d[s] = x
    idx = d[SYMS[0]].index
    for s in SYMS[1:]:
        idx = idx.intersection(d[s].index)
    return {s: d[s].loc[idx] for s in SYMS}, idx


def event_study(o, c, sig, h, legs=1):
    """sig[i] in {-1,0,1} по закрытию бара i. Возвращает (индексы входа, доходности в б.п. на ногу)."""
    idx = np.flatnonzero(sig != 0)
    idx = idx[idx < len(c) - h - 2]
    ii, rr = [], []
    last = -1
    for i in idx:
        if i <= last:
            continue
        r = sig[i] * (c[i + h] / o[i + 1] - 1) * 1e4
        ii.append(i)
        rr.append(r)
        last = i + h
    return np.array(ii), np.array(rr)


def summarize(ii, rr, n_bars, legs=1):
    if len(rr) < 30:
        return None
    half = n_bars // 2
    a, b = rr[ii < half], rr[ii >= half]
    se = rr.std(ddof=1) / np.sqrt(len(rr))
    return dict(n=len(rr), gross=rr.mean(), t=rr.mean() / se, win=100 * (rr > 0).mean(),
                h1=a.mean() if len(a) else np.nan, h2=b.mean() if len(b) else np.nan,
                net_taker=rr.mean() - COST_TAKER * legs, net_maker=rr.mean() - COST_MAKER * legs)


def zscore_move(c, m, win=2016):
    r1 = np.diff(np.log(c), prepend=np.log(c[0]))
    sd = pd.Series(r1).rolling(win).std().values
    mv = np.log(c) - np.log(np.r_[np.full(m, c[0]), c[:-m]])
    return mv / (sd * np.sqrt(m))


def lead_lag(d, leader, target, m, k, h):
    z = zscore_move(d[leader].c.values, m)
    sig = np.where(z > k, 1, np.where(z < -k, -1, 0))
    sig[:2100] = 0
    return event_study(d[target].o.values, d[target].c.values, sig, h)


def spread_reversion(d, a, b, win, k, h):
    """Лонг/шорт отношения a/b при отклонении log(a/b) от скользящего среднего (две ноги)."""
    lr = np.log(d[a].c.values) - np.log(d[b].c.values)
    s = pd.Series(lr)
    z = ((s - s.rolling(win).mean()) / s.rolling(win).std()).values
    sig = np.where(z > k, -1, np.where(z < -k, 1, 0))                     # z>k: ratio дорогой -> шорт a / лонг b
    sig[:win + 5] = 0
    oa, ca = d[a].o.values, d[a].c.values
    ob, cb = d[b].o.values, d[b].c.values
    idx = np.flatnonzero(sig != 0)
    idx = idx[idx < len(ca) - h - 2]
    ii, rr, last = [], [], -1
    for i in idx:
        if i <= last:
            continue
        ra = ca[i + h] / oa[i + 1] - 1
        rb = cb[i + h] / ob[i + 1] - 1
        rr.append(sig[i] * (ra - rb) * 1e4)
        ii.append(i)
        last = i + h
    return np.array(ii), np.array(rr)


def taker_imbalance(x, m, k, h, mode):
    """Дисбаланс агрессивных покупок/продаж (по taker buy volume) за m баров, z-score."""
    imb = (2 * x.tb.values - x.v.values) / np.where(x.v.values == 0, 1, x.v.values)
    sm = pd.Series(imb).rolling(m).mean()
    z = ((sm - sm.rolling(2016).mean()) / sm.rolling(2016).std()).values
    sgn = 1 if mode == "follow" else -1
    sig = np.where(z > k, sgn, np.where(z < -k, -sgn, 0))
    sig[:2100] = 0
    return event_study(x.o.values, x.c.values, sig, h)


def run(data, data_x=None):
    d, idx = load(data)
    n = len(idx)
    rows = []

    def add(name, res, legs=1):
        s = summarize(*res, n, legs)
        if s:
            rows.append(dict(идея=name, **s))

    for leader, target in (("BTCUSDT", "ETHUSDT"), ("BTCUSDT", "XRPUSDT"), ("ETHUSDT", "XRPUSDT")):
        for m in (1, 3):
            for k in (2.0, 3.0):
                for h in (1, 3, 6):
                    add(f"Lead-lag {leader[:3]}->{target[:3]} m{m} z>{k:g} h{h}", lead_lag(d, leader, target, m, k, h))
    for win in (288, 1152):
        for k in (2.0, 3.0):
            for h in (12, 72):
                add(f"Спред ETH/BTC win{win} z>{k:g} h{h}", spread_reversion(d, "ETHUSDT", "BTCUSDT", win, k, h), legs=2)
                add(f"Спред XRP/BTC win{win} z>{k:g} h{h}", spread_reversion(d, "XRPUSDT", "BTCUSDT", win, k, h), legs=2)
    if data_x:
        dx, _ = load(data_x)
        for s in SYMS:
            for m in (3, 12):
                for k in (2.0, 3.0):
                    for h in (3, 12):
                        for mode in ("follow", "fade"):
                            add(f"Taker-дисбаланс {s[:3]} m{m} z>{k:g} h{h} {mode}", taker_imbalance(dx[s], m, k, h, mode))
    df = pd.DataFrame(rows)
    pd.set_option("display.width", 250)
    pd.set_option("display.max_rows", 500)
    return df


if __name__ == "__main__":
    df = run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    df.to_csv("intraday2.csv", index=False)
    print(f"всего идей: {len(df)}; издержки круга: taker {COST_TAKER:g} б.п., maker {COST_MAKER:g} б.п. (на ногу)")
    print("\nТОП-25 по валовой доходности (б.п. на сделку):")
    print(df.sort_values("gross", ascending=False).head(25).round(2).to_string(index=False))
    print("\nдоля идей с gross>издержки taker:", round(100 * (df.net_taker > 0).mean(), 1), "% | maker:", round(100 * (df.net_maker > 0).mean(), 1), "%")
    print("доля идей |t|>2:", round(100 * (df.t.abs() > 2).mean(), 1), "%  (при случайности ожидаем ~5%)")
    print("\nУстойчивые идеи (gross>0 в обеих половинах и t>2.5):")
    print(df[(df.h1 > 0) & (df.h2 > 0) & (df.t > 2.5)].sort_values("gross", ascending=False).round(2).to_string(index=False))
