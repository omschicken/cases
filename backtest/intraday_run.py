"""Прогон внутридневных стратегий: python intraday_run.py <папка_с_5m_csv> [tf_override_min]

Для каждой пары и стратегии: сценарии издержек gross / real / maker, метрики и доходность по годам (real).
"""
import os
import sys
from multiprocessing import Pool

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import intraday as I  # noqa: E402
import intraday_strats as X  # noqa: E402

SYMS = ["BTCUSDT", "ETHUSDT", "XRPUSDT"]
WARM = 300


def resample(df, tf):
    d = df.copy()
    d.index = pd.to_datetime(d.t, unit="ms")
    d = d.resample(f"{tf}min", label="left", closed="left").agg(
        {"t": "first", "o": "first", "h": "max", "l": "min", "c": "last", "v": "sum"}).dropna()
    return d.reset_index(drop=True)


def job(args):
    sym, data, base_tf, override = args
    raw = pd.read_csv(f"{data}/{sym}_{base_tf}m.csv")
    ctxs = {}
    rows = []
    for name, native_tf, builder in X.catalog():
        tf = override or native_tf
        if tf not in ctxs:
            ctxs[tf] = X.Ctx(raw if tf == base_tf else resample(raw, tf), tf)
        x = ctxs[tf]
        plans = builder(x)
        years = pd.to_datetime(x.t, unit="ms").year.values
        row = dict(sym=sym, strat=name, tf=tf, plans=len(plans))
        for scen in ("gross", "real", "maker"):
            tr, curve, mdd = I.simulate(x.o, x.h, x.l, x.c, plans, I.COSTS[scen], start=WARM)
            s = I.summarize(tr, curve, mdd, x.bpd)
            for k, v in s.items():
                row[f"{scen}_{k}"] = v
            if scen == "real":
                yrs = years[WARM:]
                for y in np.unique(yrs):
                    idx = np.flatnonzero(yrs == y)
                    prev = curve[idx[0] - 1] if idx[0] > 0 else 1.0
                    row[f"y{y}"] = (curve[idx[-1]] / prev - 1) * 100
        rows.append(row)
    return rows


if __name__ == "__main__":
    data = sys.argv[1]
    override = int(sys.argv[2]) if len(sys.argv) > 2 else None
    base_tf = override or 5
    with Pool(3) as p:
        res = p.map(job, [(s, data, base_tf, override) for s in SYMS])
    df = pd.DataFrame([r for rr in res for r in rr])
    df.to_csv(f"intraday_{override or 5}m.csv", index=False)
    pd.set_option("display.width", 250)
    pd.set_option("display.max_columns", 40)
    agg = df.groupby("strat", sort=False).agg(
        tpd=("real_tpd", "mean"), trades=("real_trades", "mean"), wr=("real_wr", "mean"),
        gross_avgR=("gross_avgR", "mean"), real_avgR=("real_avgR", "mean"), maker_avgR=("maker_avgR", "mean"),
        t_real=("real_t", "mean"), pf_real=("real_pf", "mean"), net_real=("real_net", "mean"),
        net_maker=("maker_net", "mean"), dd_real=("real_dd", "max"), feeR=("real_feeR", "mean"),
        pairs_pos=("real_net", lambda s: int((s > 0).sum())), pairs_pos_maker=("maker_net", lambda s: int((s > 0).sum())))
    print(agg.sort_values("net_real", ascending=False).round(2).to_string())
