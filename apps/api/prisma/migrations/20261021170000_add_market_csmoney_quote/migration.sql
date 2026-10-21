-- Read-only reference quotes from CSMarketCap for the CS.MONEY marketplace.
-- Intentionally separate from market_item, CaseItem, wallets, history and inventory.
CREATE TABLE IF NOT EXISTS public.market_csmoney_quote (
  market_hash_name text PRIMARY KEY,
  price_usd_milli bigint NOT NULL CHECK (price_usd_milli > 0),
  price_locked_usd_milli bigint CHECK (price_locked_usd_milli > 0),
  offers integer NOT NULL CHECK (offers >= 0),
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_csmoney_quote_observed_idx
  ON public.market_csmoney_quote (observed_at DESC);

CREATE TABLE IF NOT EXISTS public.market_csmoney_sync_state (
  id integer PRIMARY KEY CHECK (id = 1),
  last_started timestamptz,
  last_success timestamptz,
  last_error text,
  rows_received integer,
  rows_saved integer,
  duration_ms integer
);
INSERT INTO public.market_csmoney_sync_state(id) VALUES(1) ON CONFLICT DO NOTHING;

-- The application sync runs via direct Postgres credentials, not public API roles.
-- Until explicit read policies are designed, make this data private to server roles.
ALTER TABLE public.market_csmoney_quote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_csmoney_sync_state ENABLE ROW LEVEL SECURITY;
