-- ─── Row Level Security Policies ─────────────────────────────────────────────
--
-- This file enables Row Level Security (RLS) on every core table and defines
-- the policies that govern who can SELECT, INSERT, UPDATE, or DELETE rows.
--
-- Without these policies, RLS being "enabled" on a table just means nobody
-- (except service_role, which bypasses RLS entirely) can access it at all.
-- Each CREATE POLICY below grants a specific, narrow slice of access back to
-- the `authenticated` role.
--
-- Domain model recap:
--   pgs            -> a "PG" (paying-guest accommodation), owned by one user
--   profiles       -> one row per user; profiles.pg_id links a resident to a PG
--   machines       -> washing machines etc. belonging to a PG
--   schedule       -> bookings of a machine by a resident
--   join_requests  -> a resident's request to join a PG, reviewed by the owner
-- ─────────────────────────────────────────────────────────────────────────────

-- Turn on RLS for every table. Until policies are added below, this blocks
-- all access for normal (non service_role) clients by default.
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pgs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- MACHINES
-- Washing machines (or similar shared equipment) that belong to a PG.
-- ═══════════════════════════════════════════════════════════════════════════

-- Any logged-in user can browse the machine list, regardless of which PG
-- they belong to (e.g. while exploring a PG before joining).
CREATE POLICY "Authenticated users can view machines" ON public.machines FOR
SELECT
    TO authenticated USING (true);

-- Only the owner of the PG that a machine belongs to may add new machines.
-- The WITH CHECK runs against the row being inserted, so `machines.pg_id`
-- here refers to the pg_id on the new row.
CREATE POLICY "PG owner can insert machines" ON public.machines FOR INSERT TO authenticated
WITH
    CHECK (
        EXISTS (
            SELECT
                1
            FROM
                pgs
            WHERE
                pgs.id = machines.pg_id
                AND pgs.owner_id = auth.uid ()
        )
    );

-- Only the owner of the PG that a machine belongs to may update it.
-- USING gates which existing rows are even visible/targetable for the
-- update; WITH CHECK re-validates the same condition against the new
-- (post-update) row, so an owner can't reassign a machine to a PG they
-- don't own.
CREATE POLICY "PG owner can update machines" ON public.machines FOR
UPDATE TO authenticated USING (
    EXISTS (
        SELECT
            1
        FROM
            pgs
        WHERE
            pgs.id = machines.pg_id
            AND pgs.owner_id = auth.uid ()
    )
)
WITH
    CHECK (
        EXISTS (
            SELECT
                1
            FROM
                pgs
            WHERE
                pgs.id = machines.pg_id
                AND pgs.owner_id = auth.uid ()
        )
    );

-- Only the owner of the PG that a machine belongs to may delete it.
CREATE POLICY "PG owner can delete machines" ON public.machines FOR DELETE TO authenticated USING (
    EXISTS (
        SELECT
            1
        FROM
            pgs
        WHERE
            pgs.id = machines.pg_id
            AND pgs.owner_id = auth.uid ()
    )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PGS
-- The PG (paying-guest accommodation) entity itself, one row per property.
-- ═══════════════════════════════════════════════════════════════════════════

-- Any logged-in user can look up/browse PGs (needed for things like an
-- invite-code lookup or directory listing during onboarding).
CREATE POLICY "Authenticated users can view PGs" ON public.pgs FOR
SELECT
    TO authenticated USING (true);

-- A user may only create a PG record naming themself as the owner; they
-- can't insert a PG row that points to someone else as owner_id.
CREATE POLICY "Owners can create PGs" ON public.pgs FOR INSERT TO authenticated
WITH
    CHECK (owner_id = auth.uid ());

-- Only the owner of a PG may update its details (name, address, etc.), and
-- the WITH CHECK ensures they can't reassign ownership away from themselves
-- in the same update.
CREATE POLICY "Owners can update their PG" ON public.pgs FOR
UPDATE TO authenticated USING (owner_id = auth.uid ())
WITH
    CHECK (owner_id = auth.uid ());

-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILES
-- One row per user. profiles.pg_id links a resident to the PG they belong to.
-- ═══════════════════════════════════════════════════════════════════════════

-- Any logged-in user can view any profile. (Broad on purpose here; contrast
-- with rls_policies.sql, which scopes profile visibility to "own profile" or
-- "pg-mates only" — see that file for the tighter alternative.)
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR
SELECT
    TO authenticated USING (true);

-- A user may only insert a profile row for themself (id must match their
-- own auth.uid()). This is how a profile gets created on first sign-in.
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated
WITH
    CHECK (id = auth.uid ());

-- A user may update their own profile (e.g. settings, display name).
CREATE POLICY "Users can update their own profile" ON public.profiles FOR
UPDATE TO authenticated USING (id = auth.uid ())
WITH
    CHECK (id = auth.uid ());

-- A PG owner may update the profiles of residents linked to their own PG
-- (e.g. approving a resident, ejecting them, marking them deleted). Note
-- this is a second, additive UPDATE policy on top of "Users can update
-- their own profile" — Postgres OR's multiple permissive policies of the
-- same command type together, so either condition being true allows the
-- update.
CREATE POLICY "PG owners can manage resident profiles" ON public.profiles FOR
UPDATE TO authenticated USING (
    EXISTS (
        SELECT
            1
        FROM
            pgs
        WHERE
            pgs.id = profiles.pg_id
            AND pgs.owner_id = auth.uid ()
    )
)
WITH
    CHECK (
        EXISTS (
            SELECT
                1
            FROM
                pgs
            WHERE
                pgs.id = profiles.pg_id
                AND pgs.owner_id = auth.uid ()
        )
    );

-- A user may delete their own profile (account deletion).
CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE TO authenticated USING (id = auth.uid ());

-- ═══════════════════════════════════════════════════════════════════════════
-- JOIN_REQUESTS
-- A resident's request to join a specific PG, reviewed by that PG's owner.
-- ═══════════════════════════════════════════════════════════════════════════

-- A user may only submit a join request as themself (resident_id must be
-- their own auth.uid()), not on behalf of another user.
CREATE POLICY "Residents can create join requests" ON public.join_requests FOR INSERT TO authenticated
WITH
    CHECK (resident_id = auth.uid ());

-- A resident can see only their own join requests (to track pending /
-- approved / rejected status).
CREATE POLICY "Residents can view their own requests" ON public.join_requests FOR
SELECT
    TO authenticated USING (resident_id = auth.uid ());

-- A PG owner can see all join requests submitted for the PG(s) they own,
-- so they can review and act on them.
CREATE POLICY "PG owners can view requests" ON public.join_requests FOR
SELECT
    TO authenticated USING (
        EXISTS (
            SELECT
                1
            FROM
                pgs
            WHERE
                pgs.id = join_requests.pg_id
                AND pgs.owner_id = auth.uid ()
        )
    );

-- A resident can withdraw (delete) their own join request.
-- NOTE: there is no explicit policy here letting the PG owner delete or
-- update a join request (e.g. to approve/reject it) — compare with
-- rls_policies.sql, where "join_requests: owners can manage requests for
-- their pg" uses FOR ALL to additionally cover UPDATE/DELETE for owners.
CREATE POLICY "Residents can delete their own join requests" ON public.join_requests FOR DELETE TO authenticated USING (resident_id = auth.uid ());

-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEDULE
-- Bookings of a machine by a resident.
-- ═══════════════════════════════════════════════════════════════════════════

-- A resident may only create a booking for themself (resident_id must match
-- their own auth.uid()), and only for a machine that belongs to the same PG
-- they're a member of (checked by joining their profile's pg_id to the
-- machine's pg_id).
CREATE POLICY "Residents can create bookings" ON public.schedule FOR INSERT TO authenticated
WITH
    CHECK (
        resident_id = auth.uid ()
        AND EXISTS (
            SELECT
                1
            FROM
                profiles p
                JOIN machines m ON m.pg_id = p.pg_id
            WHERE
                p.id = auth.uid ()
                AND m.id = schedule.machine_id
        )
    );

-- Any member of the same PG as the machine can view bookings on it (so
-- residents can see the full schedule, not just their own slots).
CREATE POLICY "PG members can view bookings" ON public.schedule FOR
SELECT
    TO authenticated USING (
        EXISTS (
            SELECT
                1
            FROM
                profiles p
                JOIN machines m ON m.pg_id = p.pg_id
            WHERE
                p.id = auth.uid ()
                AND m.id = schedule.machine_id
        )
    );

-- A resident may update only their own bookings (e.g. marking a booking as
-- completed), and the WITH CHECK stops them from reassigning a booking to
-- another resident_id in the same update.
CREATE POLICY "Residents can update their own bookings" ON public.schedule FOR
UPDATE TO authenticated USING (resident_id = auth.uid ())
WITH
    CHECK (resident_id = auth.uid ());

-- A PG owner may update any booking made on a machine belonging to a PG
-- they own (e.g. cancelling/reassigning a resident's slot). This is an
-- additional permissive UPDATE policy alongside "Residents can update their
-- own bookings" — either condition being true allows the update.
CREATE POLICY "PG owners can update bookings" ON public.schedule FOR
UPDATE TO authenticated USING (
    EXISTS (
        SELECT
            1
        FROM
            machines
            JOIN pgs ON pgs.id = machines.pg_id
        WHERE
            machines.id = schedule.machine_id
            AND pgs.owner_id = auth.uid ()
    )
)
WITH
    CHECK (
        EXISTS (
            SELECT
                1
            FROM
                machines
                JOIN pgs ON pgs.id = machines.pg_id
            WHERE
                machines.id = schedule.machine_id
                AND pgs.owner_id = auth.uid ()
        )
    );

-- A resident may cancel (delete) only their own bookings.
-- NOTE: unlike "schedule: owners can manage all bookings in their pg" in
-- rls_policies.sql (FOR ALL), this file has no explicit DELETE policy
-- letting PG owners delete bookings on their own machines.
CREATE POLICY "Residents can delete their own bookings" ON public.schedule FOR DELETE TO authenticated USING (resident_id = auth.uid ());