-- 1. Create the PGs table first (without the owner foreign key constraint initially to avoid cyclic dependency)
CREATE TABLE pgs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    invite_code TEXT UNIQUE NOT NULL,
    owner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create the Profiles table (links to Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT CHECK (role IN ('resident', 'owner')) NOT NULL,
    pg_id UUID REFERENCES pgs(id) ON DELETE SET NULL,
    is_approved BOOLEAN DEFAULT FALSE NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    wash_score INTEGER DEFAULT 100 NOT NULL, -- NEW: Gamification trust score
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Now link the owner_id in pgs back to the profiles table safely
ALTER TABLE pgs ADD CONSTRAINT fk_pg_owner FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. Create the Machines table
CREATE TABLE machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pg_id UUID REFERENCES pgs(id) ON DELETE CASCADE NOT NULL,
    machine_number INTEGER NOT NULL,
    cycle_duration INTEGER DEFAULT 45 NOT NULL, -- NEW: Wash cycle length in minutes
    status TEXT CHECK (status IN ('free', 'occupied', 'out_of_order')) DEFAULT 'free' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Create the Schedule/Bookings table
CREATE TABLE schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id UUID REFERENCES machines(id) ON DELETE CASCADE NOT NULL,
    resident_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT CHECK (status IN ('scheduled', 'active', 'completed', 'incomplete', 'expired', 'cancelled')) DEFAULT 'scheduled' NOT NULL
    -- NEW: 'incomplete', 'expired', and 'cancelled' statuses added
);

-- 6. Create the Join Requests table for Owner Approvals
CREATE TABLE join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pg_id UUID REFERENCES pgs(id) ON DELETE CASCADE NOT NULL,
    resident_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);