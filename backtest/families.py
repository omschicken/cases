"""Четыре семейства внутридневных стратегий: сигналы на 1H (+4H тренд), исполнение на 5m.

A. Откат в тренде   B. Возврат к среднему в диапазоне   C. Разворот после выноса ликвидности   D. Фейд ложного пробоя
Вход: рынок по open 5m-бара сразу после закрытия сигнального 1H-бара. SL по структуре или ATR, TP = RR * стоп,
макс. удержание 24 ч. Один сигнал за раз; если в одном 5m-баре достигнуты и стоп, и тейк - считаем стоп.
Издержки Hyperliquid: taker 0.045% + slip 0.01% на вход/SL/выход по времени, TP - maker 0.02%.

python families.py <папка_5m_csv> [папка_результатов]
"""
import itertools
import os
import sys
from multiprocessing import Pool

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import intraday as I  # noqa: E402
import strategies as S  # noqa: E402
from intraday import Order, Plan  # noqa: E402

SYMS = ["BTCUSDT", "ETHUSDT", "XRPUSDT"]
HL = dict(taker=0.00045, maker=0.0002, slip=0.0001)
HL_TAKER = dict(taker=0.00045, maker=0.00045, slip=0.0001)     # осторожный вариант: TP тоже по taker
HOLD = 24 * 12                                                 # 24 часа в 5m-барах
SKIP_DAYS = 14                                                 # прогрев индикаторов


# ───────────────────────── данные ─────────────────────────
class Data:
    def __init__(self, sym, folder):
        raw = pd.read_csv(f"{folder}/{sym}_5m.csv")
        self.raw = raw
        self.t5 = raw.t.values.astype("int64")
        d = raw.copy()
        d.index = pd.to_datetime(d.t, unit="ms")
        agg = {"t": "first", "o": "first", "h": "max", "l": "min", "c": "last", "v": "sum"}

        def rs(rule, bars):
            r = d.resample(rule, label="left", closed="left").agg(agg)
            cnt = d.o.resample(rule, label="left", closed="left").count()
            return r[cnt == bars].dropna().reset_index(drop=True)

        h1, h4 = rs("1h", 12), rs("4h", 48)
        self.h1, self.h4 = h1, h4
        self.o, self.h, self.l, self.c = (h1[k].values for k in "ohlc")
        self.t1 = h1.t.values.astype("int64")
        self.n1 = len(h1)
        # индекс последнего 5m-бара внутри каждого часа (сигнал ставится по его закрытию)
        pos = np.searchsorted(self.t5, self.t1 + 55 * 60_000)
        self.j5 = np.where((pos < len(self.t5)) & (self.t5[np.minimum(pos, len(self.t5) - 1)] == self.t1 + 55 * 60_000), pos, -1)
        self.atr = S.atr(self.h, self.l, self.c, 14)
        self.ema20 = S.ema(self.c, 20)
        self.adx, _, _ = S.adx_di(self.h, self.l, self.c, 14)
        # тренд 4H по последнему ЗАКРЫТОМУ 4H-бару на момент закрытия 1H-бара
        ema50_4 = S.ema(h4.c.values, 50)
        t4_close = h4.t.values.astype("int64") + 4 * 3600_000
        k4 = np.searchsorted(t4_close, self.t1 + 3600_000, side="right") - 1
        self.trend = np.where(k4 >= 50, np.sign(h4.c.values[np.clip(k4, 0, None)] - ema50_4[np.clip(k4, 0, None)]), 0.0)
        self.start5 = int(np.searchsorted(self.t5, self.t5[0] + SKIP_DAYS * 86400_000))
        self.cache = {}

    def roll(self, kind, n):
        key = (kind, n)
        if key not in self.cache:
            f = {"max": S.roll_max, "min": S.roll_min}[kind]
            self.cache[key] = S.sh(f(self.h if kind == "max" else self.l, n))     # экстремум n баров ДО текущего
        return self.cache[key]


# ───────────────────────── сигналы (k, side, stop) ─────────────────────────
def _stop(d, k, side, mode, struct_stop):
    c = d.c[k]
    if mode == "struct":
        return struct_stop
    return c - side * float(mode) * d.atr[k]


def sig_A(d, stop_mode):
    """Откат в тренде: 4H цена против EMA50; на 1H свеча коснулась EMA20 и закрылась по тренду."""
    out = []
    for k in range(60, d.n1):
        if d.trend[k] > 0 and d.l[k] <= d.ema20[k] < d.c[k]:
            side, st = 1, d.l[max(0, k - 4):k + 1].min()
        elif d.trend[k] < 0 and d.h[k] >= d.ema20[k] > d.c[k]:
            side, st = -1, d.h[max(0, k - 4):k + 1].max()
        else:
            continue
        out.append((k, side, _stop(d, k, side, stop_mode, st)))
    return out


def sig_B(d, band, adx_max, stop_mode):
    """Возврат к среднему: ADX < порога, цена у границы диапазона (Bollinger или Donchian-48)."""
    c = d.c
    if band == "dc48":
        hh, ll = d.roll("max", 48), d.roll("min", 48)
        pos_in = (c - ll) / np.where(hh - ll > 0, hh - ll, np.nan)
        wide = (hh - ll) / c > 0.015
        long_m, short_m = (pos_in <= 0.1) & wide, (pos_in >= 0.9) & wide
    else:
        m, sd = S.sma(c, 20), pd.Series(c).rolling(20).std(ddof=0).values
        mult = float(band[2:])
        long_m, short_m = c < m - mult * sd, c > m + mult * sd
    out = []
    for k in range(60, d.n1):
        if not d.adx[k] < adx_max:
            continue
        if long_m[k]:
            side, st = 1, d.l[max(0, k - 4):k + 1].min()
        elif short_m[k]:
            side, st = -1, d.h[max(0, k - 4):k + 1].max()
        else:
            continue
        out.append((k, side, _stop(d, k, side, stop_mode, st)))
    return out


def sig_C(d, n, stop_mode):
    """Вынос ликвидности: прокол экстремума n 1H-баров и возврат закрытием внутрь диапазона."""
    hh, ll = d.roll("max", n), d.roll("min", n)
    out = []
    for k in range(n + 2, d.n1):
        if d.h[k] > hh[k] and d.c[k] < hh[k]:
            side, st = -1, d.h[k] + 0.1 * d.atr[k]
        elif d.l[k] < ll[k] and d.c[k] > ll[k]:
            side, st = 1, d.l[k] - 0.1 * d.atr[k]
        else:
            continue
        out.append((k, side, _stop(d, k, side, stop_mode, st)))
    return out


def sig_D(d, n, m, stop_mode):
    """Фейд ложного пробоя: закрытие за уровнем n-часового экстремума, затем в пределах m баров закрытие обратно внутри."""
    hh, ll = d.roll("max", n), d.roll("min", n)
    up_break = d.c > hh
    dn_break = d.c < ll
    out = []
    for k in range(n + 2, d.n1):
        side = 0
        for b in range(k - m, k):
            if up_break[b] and d.c[k] < hh[b] and not up_break[k]:
                side, lvl_b, st = -1, b, d.h[b:k + 1].max() + 0.1 * d.atr[k]
                break
            if dn_break[b] and d.c[k] > ll[b] and not dn_break[k]:
                side, lvl_b, st = 1, b, d.l[b:k + 1].min() - 0.1 * d.atr[k]
                break
        if side:
            out.append((k, side, _stop(d, k, side, stop_mode, st)))
    return out


FAMILIES = {
    "A. Откат в тренде": ([(f"stop{sm}", sm) for sm in ("struct", 1.5, 2.0)], lambda d, sm: sig_A(d, sm)),
    "B. Возврат в диапазоне": ([(f"{b}/adx<{a}/stop{sm}", (b, a, sm)) for b in ("bb2", "bb2.5", "dc48") for a in (20, 25) for sm in (1.5, 2.0)],
                               lambda d, p: sig_B(d, *p)),
    "C. Вынос ликвидности": ([(f"N{n}/stop{sm}", (n, sm)) for n in (24, 48, 72) for sm in ("struct", 1.5)], lambda d, p: sig_C(d, *p)),
    "D. Фейд ложного пробоя": ([(f"N{n}/M{m}/stop{sm}", (n, m, sm)) for n in (24, 48) for m in (3, 6) for sm in ("struct", 1.5)],
                                lambda d, p: sig_D(d, *p)),
}
RRS = (1.5, 2.0, 3.0)


def make_plans(d, sigs, rr):
    plans = {}
    for k, side, st in sigs:
        j = d.j5[k]
        if j < 0:
            continue
        c = d.c[k]
        dist = (c - st) * side
        if dist <= 0 or dist / c < 0.0015:
            continue
        plans[int(j)] = Plan([Order(side, "m", None, st, c + side * rr * dist)], valid_until=int(j) + 1, hold=HOLD)
    return plans


def task(args):
    """(sym, family, folder) -> {(param_name, rr, cost): array [exit_ms, side, R, kind(0 sl,1 tp,2 time), entry_ms]}"""
    sym, fam, folder = args
    d = Data(sym, folder)
    grid, builder = FAMILIES[fam]
    out = {}
    for name, p in grid:
        sigs = builder(d, p)
        for rr in RRS:
            plans = make_plans(d, sigs, rr)
            for cname, cost in (("hl", HL), ("hl_taker", HL_TAKER)):
                tr, _, _ = I.simulate(d.raw.o.values, d.raw.h.values, d.raw.l.values, d.raw.c.values, plans, cost,
                                      start=d.start5, stop_first=True)
                arr = np.array([(d.t5[t[0]], t[1], t[3], {"sl": 0, "tp": 1, "time": 2}[t[5]], d.t5[t[8]]) for t in tr], dtype=float)
                out[(name, rr, cname)] = arr.reshape(-1, 5)
    return sym, fam, d.t5[d.start5], d.t5[-1], out


# ───────────────────────── статистика ─────────────────────────
def wilson_lo(k, n, z=1.96):
    if n == 0:
        return 0.0
    p = k / n
    return (p + z * z / (2 * n) - z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n)


def stats(arr):
    n = len(arr)
    if n == 0:
        return dict(n=0, wr=0.0, exp=0.0, se=0.0, be=np.nan, lo=0.0, streak=0)
    r = arr[:, 2]
    win = r > 0
    st = m = 0
    for w in win[np.argsort(arr[:, 0])]:
        st = 0 if w else st + 1
        m = max(m, st)
    aw, al = (r[win].mean() if win.any() else 0.0), (-r[~win].mean() if (~win).any() else 1.0)
    return dict(n=n, wr=100 * win.mean(), exp=r.mean(), se=r.std(ddof=1) / np.sqrt(n) if n > 1 else 0.0,
                be=100 * al / (aw + al) if aw + al > 0 else np.nan, lo=100 * wilson_lo(win.sum(), n), streak=m)


def window(arr, t0, t1):
    return arr[(arr[:, 0] >= t0) & (arr[:, 0] < t1)]


def pooled(res, fam, key, t0, t1, syms=SYMS):
    parts = [window(res[(s, fam)][key], t0, t1) for s in syms if (s, fam) in res]
    return np.vstack(parts) if parts else np.zeros((0, 5))


def main(folder, outdir):
    os.makedirs(outdir, exist_ok=True)
    jobs = [(s, f, folder) for s in SYMS for f in FAMILIES]
    with Pool(4) as p:
        got = p.map(task, jobs)
    res = {(s, f): o for s, f, _, _, o in got}
    T0 = max(g[2] for g in got)
    T1 = min(g[3] for g in got)
    month = 30.4375 * 86400_000
    half = T0 + (T1 - T0) / 2
    years = [(T0 + i * 365.25 * 86400_000, T0 + (i + 1) * 365.25 * 86400_000) for i in range(3)]
    print(f"данные: {pd.to_datetime(T0, unit='ms').date()} .. {pd.to_datetime(T1, unit='ms').date()}  ({(T1 - T0) / month:.1f} мес.), "
          f"половины делятся {pd.to_datetime(half, unit='ms').date()}")
    pd.set_option("display.width", 250)
    pd.set_option("display.max_columns", 40)

    summary = []
    for fam, (grid, _) in FAMILIES.items():
        keys = [(nm, rr, "hl") for nm, _ in grid for rr in RRS]
        rows = []
        for key in keys:
            full = pooled(res, fam, key, T0, T1 + 1)
            h1 = pooled(res, fam, key, T0, half)
            h2 = pooled(res, fam, key, half, T1 + 1)
            sf, s1, s2 = stats(full), stats(h1), stats(h2)
            yrs = [stats(window(full, a, b))["exp"] for a, b in years]
            coins = [stats(window(res[(s, fam)][key], T0, T1 + 1))["exp"] for s in SYMS]
            rows.append(dict(fam=fam, params=key[0], rr=key[1], n=sf["n"], per_day=sf["n"] / ((T1 - T0) / 86400_000), wr=sf["wr"], exp=sf["exp"],
                             exp_h1=s1["exp"], n_h1=s1["n"], exp_h2=s2["exp"], n_h2=s2["n"], wr_h2=s2["wr"], lo_h2=s2["lo"], be_h2=s2["be"],
                             y1=yrs[0], y2=yrs[1], y3=yrs[2], btc=coins[0], eth=coins[1], xrp=coins[2], streak=sf["streak"]))
        df = pd.DataFrame(rows)
        # --- walk-forward: подбор на 12 мес, тест на следующих 6 (4 окна со сдвигом 6 мес) ---
        wf_rows = []
        for f in range(4):
            tr0, tr1 = T0 + 6 * f * month, T0 + (12 + 6 * f) * month
            te0, te1 = tr1, min(tr1 + 6 * month, T1 + 1)
            best, bexp = None, -9
            for key in keys:
                a = pooled(res, fam, key, tr0, tr1)
                if len(a) >= 60:
                    e = a[:, 2].mean()
                    if e > bexp:
                        best, bexp = key, e
            if best is None:
                continue
            te = pooled(res, fam, best, te0, te1)
            wf_rows.append((best, bexp, te))
        wf = np.vstack([w[2] for w in wf_rows]) if wf_rows else np.zeros((0, 5))
        sw = stats(wf)
        # --- выбор по первой половине -> проверка на второй ---
        elig = df[df.n_h1 >= 100].sort_values("exp_h1", ascending=False)
        top = elig.iloc[0] if len(elig) else None
        print("\n" + "=" * 110)
        print(fam)
        print(f"комбинаций: {len(df)}; в плюсе за весь период: {100 * (df.exp > 0).mean():.0f}%; в плюсе в 1-й половине: {100 * (df.exp_h1 > 0).mean():.0f}%; "
              f"во 2-й: {100 * (df.exp_h2 > 0).mean():.0f}%; в плюсе в обеих: {100 * ((df.exp_h1 > 0) & (df.exp_h2 > 0)).mean():.0f}%; "
              f"медиана ожидания {df.exp.median():+.3f}R, лучшая {df.exp.max():+.3f}R, худшая {df.exp.min():+.3f}R")
        print("средняя по RR:", {rr: round(float(df[df.rr == rr].exp.mean()), 3) for rr in RRS})
        print(f"WALK-FORWARD (подбор 12м -> тест 6м, 4 окна): тестовых сделок {sw['n']}, винрейт {sw['wr']:.1f}%, ожидание {sw['exp']:+.3f}R ± {1.96 * sw['se']:.3f}, "
              f"безубыточный винрейт {sw['be']:.1f}%; выбранные: {[(w[0][0], w[0][1]) for w in wf_rows]}")
        if top is not None:
            print("Выбор по 1-й половине -> 2-я половина (вне выборки):")
            print(top[["params", "rr", "n_h1", "exp_h1", "n_h2", "wr_h2", "be_h2", "lo_h2", "exp_h2", "y1", "y2", "y3", "btc", "eth", "xrp", "streak"]].to_frame().T.round(3).to_string(index=False))
            tr_chosen = pooled(res, fam, (top.params, top.rr, "hl"), T0, T1 + 1)
            tr_chosen2 = pooled(res, fam, (top.params, top.rr, "hl_taker"), half, T1 + 1)
            print(f"  при TP по taker: вторая половина ожидание {stats(tr_chosen2)['exp']:+.3f}R")
            thr = {1.5: 45.0, 2.0: 38.0, 3.0: 30.0}[top.rr]
            ok = [top.n_h2 >= 200, top.wr_h2 >= thr, top.lo_h2 >= top.be_h2 + 3,
                  sum(v > 0 for v in (top.y1, top.y2, top.y3)) >= 2, sum(v > 0 for v in (top.btc, top.eth, top.xrp)) >= 2]
            print("  критерии [n_oos>=200, винрейт>=порог, нижняя гр. ДИ>=БУ+3пп, плюс в >=2/3 лет, плюс на >=2/3 монет]:", ok, "-> ПРОШЁЛ" if all(ok) else "-> не прошёл")
            summary.append(dict(семейство=fam, вариант=f"{top.params} RR{top.rr}", сделок_вне=int(top.n_h2), винрейт_вне=round(top.wr_h2, 1),
                                БУ=round(top.be_h2, 1), ожидание_вне=round(top.exp_h2, 3), wf_ожидание=round(sw['exp'], 3), wf_сделок=sw['n'],
                                доля_в_плюсе=round(100 * ((df.exp_h1 > 0) & (df.exp_h2 > 0)).mean()), прошёл=all(ok)))
            pd.DataFrame(tr_chosen, columns=["exit_ms", "side", "R", "kind", "entry_ms"]).assign(
                fam=fam, params=top.params, rr=top.rr).to_csv(f"{outdir}/trades_{fam[0]}_selected.csv", index=False)
        df.round(4).to_csv(f"{outdir}/grid_{fam[0]}.csv", index=False)
        show = df.sort_values("exp", ascending=False)
        print("топ-3 и худшие-3 по всей выборке (для понимания разброса, НЕ для выбора):")
        print(show.head(3).round(3).to_string(index=False, columns=["params", "rr", "n", "per_day", "wr", "exp", "exp_h2", "y1", "y2", "y3", "btc", "eth", "xrp"]))
        print(show.tail(3).round(3).to_string(index=False, columns=["params", "rr", "n", "per_day", "wr", "exp", "exp_h2", "y1", "y2", "y3", "btc", "eth", "xrp"]))
    print("\n" + "=" * 110 + "\nИТОГ ПО СЕМЕЙСТВАМ")
    print(pd.DataFrame(summary).to_string(index=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "results")
