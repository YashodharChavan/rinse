-- ─── Lazy Sweeper — server-side migration ────────────────────────────────────
--
-- Run this entire file in the Supabase SQL editor once, then follow the
-- scheduling instructions in the commented block at the bottom.
--
-- What this does:
--   1. Creates deduct_wash_score() — an atomic score-deduction function called
--      by the lazy-sweeper edge function via supabase.rpc().
--   2. Shows you how to schedule the edge function every 5 minutes using
--      pg_cron + pg_net (both available on Supabase Pro; free tier can call
--      the function manually or via an external cron service like cron-job.org).


-- 1. Atomic wash score deduction
--    A single UPDATE with GREATEST(0, ...) avoids the read-modify-write race
--    that the old client-side code had when multiple sessions were open.
CREATE OR REPLACE FUNCTION deduct_wash_score(p_resident_id UUID, p_penalty INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET wash_score = GREATEST(0, wash_score - p_penalty)
  WHERE id = p_resident_id;
END;
$$;


-- ─── 2. Schedule the edge function (pg_cron + pg_net) ────────────────────────
--
-- Prerequisites (Dashboard → Database → Extensions):
--   • pg_cron  — schedules the job
--   • pg_net   — makes the outbound HTTP call
--
-- Before running, replace the two placeholders:
--   <project-ref>  → your Supabase project reference (e.g. "abcdefghijkl")
--   <anon-key>     → your project's anon/public key (Settings → API)
--
-- If you set CRON_SECRET via `supabase secrets set CRON_SECRET=<value>`,
-- add it as the x-cron-secret header below. Remove that header if you skipped
-- the secret (the edge function will still work without it).
--
/*
SELECT cron.schedule(
  'lazy-sweeper',         -- job name (must be unique)
  '*/5 * * * *',          -- every 5 minutes
  $$
    SELECT net.http_post(
      url     := 'https://<project-ref>.supabase.co/functions/v1/lazy-sweeper',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <anon-key>',
        'x-cron-secret', current_setting('app.settings.cron_secret', true)
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- To verify the job was created:
-- SELECT * FROM cron.job;

-- To remove it later:
-- SELECT cron.unschedule('lazy-sweeper');
*/


-- ─── Free-tier alternative (pure SQL, no HTTP) ────────────────────────────────
--
-- If you are on the Supabase free tier (no pg_net), you can instead run this
-- function directly from pg_cron without making an HTTP call. It performs the
-- same expiration + score deduction logic entirely in SQL.
--
/*
CREATE OR REPLACE FUNCTION run_lazy_sweeper()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now         TIMESTAMPTZ := NOW();
  v_grace_cutoff TIMESTAMPTZ;
  v_completed   INTEGER := 0;
BEGIN
  v_grace_cutoff := v_now - INTERVAL '15 minutes';

  -- Expire no-show bookings and deduct scores in one atomic CTE
  WITH expired_rows AS (
    UPDATE schedule
    SET status = 'expired'
    WHERE status = 'scheduled'
      AND start_time < v_grace_cutoff
    RETURNING resident_id
  ),
  penalties AS (
    SELECT resident_id, COUNT(*)::INTEGER * 10 AS deduction
    FROM expired_rows
    GROUP BY resident_id
  )
  UPDATE profiles
  SET wash_score = GREATEST(0, wash_score - penalties.deduction)
  FROM penalties
  WHERE profiles.id = penalties.resident_id;

  -- Auto-complete active bookings whose end_time has passed
  UPDATE schedule
  SET status = 'completed'
  WHERE status = 'active'
    AND end_time < v_now;

  GET DIAGNOSTICS v_completed = ROW_COUNT;

  RETURN jsonb_build_object('auto_completed', v_completed, 'run_at', v_now);
END;
$$;

-- Schedule the pure-SQL version every 5 minutes (pg_cron only, no pg_net needed)
SELECT cron.schedule(
  'lazy-sweeper-sql',
  '*/5 * * * *',
  $$ SELECT run_lazy_sweeper(); $$
);
*/
