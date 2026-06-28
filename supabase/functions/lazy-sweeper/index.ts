import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Must match GRACE_PERIOD_MINUTES in src/lib/constants.js
const GRACE_PERIOD_MINUTES = 15

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Optional CRON_SECRET guard — set via `supabase secrets set CRON_SECRET=<value>`
  // and pass the same value as x-cron-secret in your pg_cron schedule (see migration SQL).
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Use service role so we can update any resident's data regardless of RLS policies
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const now = new Date()
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_MINUTES * 60 * 1000)

  // 1. Expire scheduled bookings that blew past the grace window
  const { data: expiredBookings, error: expireError } = await supabase
    .from('schedule')
    .update({ status: 'expired' })
    .eq('status', 'scheduled')
    .lt('start_time', graceCutoff.toISOString())
    .select('resident_id')

  if (expireError) {
    console.error('[lazy-sweeper] expire error:', expireError.message)
    return new Response(JSON.stringify({ error: expireError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Deduct 10 points per missed booking from each resident's wash_score.
  //    Uses the deduct_wash_score RPC so the update is a single atomic SQL statement
  //    (GREATEST(0, wash_score - penalty)) with no read-modify-write race.
  if (expiredBookings && expiredBookings.length > 0) {
    const penaltiesByResident = expiredBookings.reduce<Record<string, number>>(
      (acc, { resident_id }) => {
        acc[resident_id] = (acc[resident_id] || 0) + 10
        return acc
      },
      {}
    )

    await Promise.all(
      Object.entries(penaltiesByResident).map(([residentId, penalty]) =>
        supabase.rpc('deduct_wash_score', {
          p_resident_id: residentId,
          p_penalty: penalty,
        })
      )
    )
  }

  // 3. Auto-complete active bookings whose end_time has already passed
  const { error: completeError } = await supabase
    .from('schedule')
    .update({ status: 'completed' })
    .eq('status', 'active')
    .lt('end_time', now.toISOString())

  if (completeError) {
    console.error('[lazy-sweeper] complete error:', completeError.message)
  }

  return new Response(
    JSON.stringify({
      expired: expiredBookings?.length ?? 0,
      run_at: now.toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
