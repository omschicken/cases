CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $block$
DECLARE scheduled_id bigint;
BEGIN
SELECT cron.schedule('casecrow-csmoney-prices','* * * * *',$job$SELECT net.http_get(url := 'https://cases-x18t.vercel.app/api/market/csmoney/refresh', timeout_milliseconds := 55000);$job$) INTO scheduled_id;
PERFORM cron.alter_job(scheduled_id, active := false);
END $block$;