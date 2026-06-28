-- ─── Row Level Security Policies ─────────────────────────────────────────────
--
-- Run this file once in the Supabase SQL editor after running schema.sql.
-- These policies enforce at the database level what the frontend already
-- enforces via conditional rendering — so a malicious client or a direct
-- API call cannot bypass access controls.
--
-- The lazy-sweeper edge function uses the service_role key and bypasses RLS
-- by design — it needs to update any resident's data regardless of ownership.
--
-- The anon key used by the frontend is bound by every policy below.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on every table
ALTER TABLE pgs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule      ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;


-- ─── PROFILES ─────────────────────────────────────────────────────────────────

-- Users always see and update their own profile (login, onboarding, settings)
CREATE POLICY "profiles: users can view own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: users can update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Needed so Supabase Auth can create the profile row on first sign-in
CREATE POLICY "profiles: users can insert own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Owners can view all profiles linked to their PG (ManageResidents, leaderboard)
CREATE POLICY "profiles: owners can view residents in their pg"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pgs
      WHERE pgs.id = profiles.pg_id
        AND pgs.owner_id = auth.uid()
    )
  );

-- Owners can approve, eject, and update is_deleted for residents in their PG
CREATE POLICY "profiles: owners can update residents in their pg"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pgs
      WHERE pgs.id = profiles.pg_id
        AND pgs.owner_id = auth.uid()
    )
  );

-- Residents can view other approved, non-deleted profiles in their own PG
-- (required for the leaderboard and schedule views)
CREATE POLICY "profiles: residents can view pg-mates"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS me
      WHERE me.id = auth.uid()
        AND me.pg_id = profiles.pg_id
        AND me.is_approved = true
        AND me.is_deleted = false
    )
  );


-- ─── PGS ──────────────────────────────────────────────────────────────────────

-- Any authenticated user may look up a PG by invite_code during the join flow
CREATE POLICY "pgs: authenticated users can view"
  ON pgs FOR SELECT
  TO authenticated
  USING (true);

-- Only the owner may create their own PG record
CREATE POLICY "pgs: owners can create their pg"
  ON pgs FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Only the owner may update PG name / address
CREATE POLICY "pgs: owners can update their pg"
  ON pgs FOR UPDATE
  USING (owner_id = auth.uid());


-- ─── MACHINES ─────────────────────────────────────────────────────────────────

-- Approved residents (and owners) can see machines in their PG to book them
CREATE POLICY "machines: pg members can view"
  ON machines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.pg_id = machines.pg_id
        AND profiles.is_approved = true
        AND profiles.is_deleted = false
    )
  );

-- Only the owner can add, edit, or remove machines (MachineManager)
CREATE POLICY "machines: owners can manage"
  ON machines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pgs
      WHERE pgs.id = machines.pg_id
        AND pgs.owner_id = auth.uid()
    )
  );


-- ─── SCHEDULE ─────────────────────────────────────────────────────────────────

-- Anyone in the PG can view the full schedule (ScheduleView shows everyone's slots)
CREATE POLICY "schedule: pg members can view all bookings"
  ON schedule FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM machines
      JOIN profiles ON profiles.pg_id = machines.pg_id
      WHERE machines.id   = schedule.machine_id
        AND profiles.id   = auth.uid()
        AND profiles.is_approved = true
        AND profiles.is_deleted  = false
    )
  );

-- Residents can only book slots for themselves
CREATE POLICY "schedule: residents can create own bookings"
  ON schedule FOR INSERT
  WITH CHECK (resident_id = auth.uid());

-- Residents can update their own booking status (active → completed)
CREATE POLICY "schedule: residents can update own bookings"
  ON schedule FOR UPDATE
  USING (resident_id = auth.uid());

-- Residents can cancel (delete) their own upcoming bookings
CREATE POLICY "schedule: residents can cancel own bookings"
  ON schedule FOR DELETE
  USING (resident_id = auth.uid());

-- Owners can manage all bookings on machines in their PG
CREATE POLICY "schedule: owners can manage all bookings in their pg"
  ON schedule FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM machines
      JOIN pgs ON pgs.id = machines.pg_id
      WHERE machines.id = schedule.machine_id
        AND pgs.owner_id = auth.uid()
    )
  );


-- ─── JOIN_REQUESTS ────────────────────────────────────────────────────────────

-- Residents can see their own pending/approved/rejected requests
CREATE POLICY "join_requests: residents can view own"
  ON join_requests FOR SELECT
  USING (resident_id = auth.uid());

-- Any authenticated user can submit a join request (Onboarding flow)
CREATE POLICY "join_requests: authenticated users can create"
  ON join_requests FOR INSERT
  TO authenticated
  WITH CHECK (resident_id = auth.uid());

-- Residents can withdraw their own pending request
CREATE POLICY "join_requests: residents can delete own"
  ON join_requests FOR DELETE
  USING (resident_id = auth.uid());

-- Owners can view, approve, and reject all requests for their PG
CREATE POLICY "join_requests: owners can manage requests for their pg"
  ON join_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pgs
      WHERE pgs.id = join_requests.pg_id
        AND pgs.owner_id = auth.uid()
    )
  );
