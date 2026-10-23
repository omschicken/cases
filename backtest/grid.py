"""Прогоны bt.py.

python grid.py fixed  [data_dir]                      зафиксированный кластер на 3 годах: пары x сценарии комиссий x пивоты 2/2 и 3/3
python grid.py search [data_dir] [profile] [guard]    устойчивость соседних параметров (не оптимизация); guard=1 включает защиту

Каждая выборка делится на 3 последовательных года, чтобы видеть, не держится ли результат на одной фазе рынка.
guard = стоп не шире 5% и тайм-стоп 7 суток: без него одна сделка с огромным SL/TP может висеть месяцами
и блокировать все новые входы (так было у XRP при пивотах 2/2: позиция ноя-2023 -> ноя-2024).
"""
import itertools
import os
import sys
from dataclasses import replace
from multiprocessing import Pool

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bt  # noqa: E402

SYMS = os.environ.get("BT_SYMS", "XRPUSDT,ETHUSDT,BTCUSDT").split(",")
WARMUP_DAYS = 30
PROFILES = {**bt.PROFILES,
            # справка: условия предыдущего теста (спот 0.05% в одну сторону, stop-вход)
            "spot_old": dict(entry_mode="stop", fee_entry=0.0005, fee_tp=0.0005, fee_sl=0.0005)}
COLS = ["trades", "winrate", "net_pct", "pf", "avg_R", "fee_R", "avg_sl_pct", "tp_rate", "dd_pct", "max_loss_streak", "max_hold_days"]
GUARD = dict(maxSlPct=0.05, max_hold=672)   # 672 бара 15m = 7 суток


def thirds(m):
    st = m.start_index(WARMUP_DAYS)
    return st, [st + (len(m.t) - st) * j // 3 for j in range(4)]


def one(args):
    """(sym, profile, overrides, data, guard) -> строка: весь период + три годовых окна."""
    sym, prof, ov, data, guard = args
    m = bt.Market(sym, 15, data)
    cfg = replace(bt.Cfg(), **{**PROFILES[prof], **ov, **(GUARD if guard else {})})
    st, cut = thirds(m)
    full = bt.run(m, cfg, start=st)
    row = dict(sym=sym, profile=prof, guard=int(guard), **{k: v for k, v in ov.items() if k not in ("R",)},
               **{k: full[k] for k in COLS})
    for j in range(3):
        r = bt.run(m, cfg, start=cut[j], end=cut[j + 1])
        row[f"y{j + 1}_net"], row[f"y{j + 1}_n"], row[f"y{j + 1}_pf"] = r["net_pct"], r["trades"], r["pf"]
    return row


def show(df, cols=None):
    pd.set_option("display.width", 250)
    pd.set_option("display.max_columns", 40)
    print((df if cols is None else df[cols]).round(2).to_string(index=False))


def fixed(data):
    jobs = [(s, p, dict(L=L, R=L, minSlPct=0.003 if p == "spot_old" else 0.005), data, g)
            for g in (False, True) for s in SYMS
            for p in ["spot_old", "limit_spec", "stop_spec", "stop_real"] for L in (2, 3)]
    with Pool(4) as pool:
        df = pd.DataFrame(pool.map(one, jobs))
    df.to_csv("fixed.csv", index=False)
    show(df, ["sym", "profile", "guard", "L", "trades", "winrate", "net_pct", "pf", "avg_R", "fee_R", "avg_sl_pct", "dd_pct",
              "max_loss_streak", "max_hold_days", "y1_net", "y1_n", "y2_net", "y2_n", "y3_net", "y3_n"])
    for p in ("limit_spec", "stop_real"):
        for L in (2, 3):
            m = bt.Market("XRPUSDT", 15, data)
            cfg = replace(bt.Cfg(), **PROFILES[p], L=L, R=L, **GUARD)
            res = bt.run(m, cfg, start=m.start_index(WARMUP_DAYS), want_trades=True)
            print(f"\nXRPUSDT {p} L={L} guard=1: сделки по полугодиям (чистый R с комиссиями)")
            show(bt.by_period(m, res["_trades"]))


def search(data, prof="stop_real", guard=True):
    grid = dict(N=[200, 300, 400], K=[8, 12, 16], L=[2, 3], tol=[0.0005, 0.001], minSlPct=[0.003, 0.005, 0.007])
    jobs = [(s, prof, dict(N=N, K=K, L=L, R=L, tol=tol, minSlPct=ms), data, guard)
            for s in SYMS for N, K, L, tol, ms in itertools.product(*grid.values())]
    with Pool(4) as pool:
        df = pd.DataFrame(pool.map(one, jobs))
    df.to_csv(f"search_{prof}_g{int(guard)}.csv", index=False)
    df["pos_years"] = (df[["y1_net", "y2_net", "y3_net"]] > 0).sum(axis=1)
    print(f"\n== {prof}, guard={int(guard)}: устойчивость по {len(df) // len(SYMS)} комбинациям на пару ==")
    for s, g in df.groupby("sym"):
        print(f"{s}: прибыльны за 3 года {100 * (g.net_pct > 0).mean():.0f}% | во всех 3 годах {100 * (g.pos_years == 3).mean():.0f}% "
              f"| медиана net% {g.net_pct.median():.1f} | медиана PF {g.pf.median():.2f} | медиана сделок {g.trades.median():.0f}")
    print("\nвлияние параметров (среднее net% за 3 года):")
    for p in ["N", "K", "L", "tol", "minSlPct"]:
        print(df.groupby(["sym", p]).net_pct.mean().unstack(0).round(1).to_string(), "\n")
    print("лучшие 10 (по PF) среди прибыльных во всех 3 годах:")
    top = df[df.pos_years == 3].sort_values("pf", ascending=False).head(10)
    show(top, ["sym", "N", "K", "L", "tol", "minSlPct", "trades", "winrate", "net_pct", "pf", "dd_pct", "y1_net", "y2_net", "y3_net"])


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "fixed"
    data = sys.argv[2] if len(sys.argv) > 2 else bt.DATA
    if cmd == "fixed":
        fixed(data)
    else:
        search(data, sys.argv[3] if len(sys.argv) > 3 else "stop_real", (sys.argv[4] if len(sys.argv) > 4 else "1") == "1")
