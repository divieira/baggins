-- Fix RLS policies for trip_cities
-- The original policy with FOR ALL USING may not work correctly for INSERT

-- Drop the old policy
DROP POLICY IF EXISTS "Users can manage trip cities" ON trip_cities;

-- Create separate policies for each operation
CREATE POLICY IF NOT EXISTS "Users can insert trip cities" ON trip_cities
  FOR INSERT WITH CHECK (has_trip_access(trip_id));

CREATE POLICY IF NOT EXISTS "Users can update trip cities" ON trip_cities
  FOR UPDATE USING (has_trip_access(trip_id));

CREATE POLICY IF NOT EXISTS "Users can delete trip cities" ON trip_cities
  FOR DELETE USING (has_trip_access(trip_id));
