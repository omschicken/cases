"""Загрузка свечей Binance (публичное зеркало data-api.binance.vision).

python fetch.py <out_dir> <days> [intervals=15m,1h,4h] [symbols=ETHUSDT,BTCUSDT,XRPUSDT]
"""
import json
import sys
import time
import urllib.request

import pandas as pd

BASE = "https://data-api.binance.vision/api/v3/klines"


def fetch(sym, iv, days):
    end = int(time.time() * 1000)
    t = end - days * 86400 * 1000
    rows = []
    while t < end:
        url = f"{BASE}?symbol={sym}&interval={iv}&startTime={t}&limit=1000"
        for attempt in range(5):
            try:
                d = json.load(urllib.request.urlopen(url, timeout=30))
                break
            except Exception:
                time.sleep(2 * (attempt + 1))
        else:
            raise SystemExit("fetch failed: " + url)
        if not d:
            break
        rows += d
        t = d[-1][0] + 1
        if len(d) < 1000:
            break
    df = pd.DataFrame(rows, columns="t o h l c v ct qv n tb tq i".split())[["t", "o", "h", "l", "c", "v", "n", "tb"]].astype(float)
    df["t"] = df["t"].astype("int64")
    return df.drop_duplicates("t").reset_index(drop=True)


if __name__ == "__main__":
    out, days = sys.argv[1], int(sys.argv[2])
    ivs = (sys.argv[3] if len(sys.argv) > 3 else "15m,1h,4h").split(",")
    syms = (sys.argv[4] if len(sys.argv) > 4 else "ETHUSDT,BTCUSDT,XRPUSDT").split(",")
    for sym in syms:
        for iv in ivs:
            df = fetch(sym, iv, days)
            df.to_csv(f"{out}/{sym}_{iv}.csv", index=False)
            print(sym, iv, len(df), pd.to_datetime(df.t.iloc[0], unit="ms"), "->", pd.to_datetime(df.t.iloc[-1], unit="ms"), flush=True)
