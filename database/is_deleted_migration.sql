-- Add is_deleted column to existing databases
-- Run this once in the Supabase SQL editor if your database was created from the old schema.sql.
-- New databases created from schema.sql already include this column.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;
