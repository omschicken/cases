-- Game operations are accessed through the trusted API. Keep them hidden from
-- Supabase's public Data API, like the other application tables.
ALTER TABLE "GameOperation" ENABLE ROW LEVEL SECURITY;
