-- Fix infinite recursion in trips RLS policies
-- The issue: trip_collaborators policies reference trips table, which references trip_collaborators
-- Solution: Make trip_collaborators policies independent, then trips can safely reference them

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view trip collaborators" ON trip_collaborators;
DROP POLICY IF EXISTS "Trip owners can manage collaborators" ON trip_collaborators;

-- Recreate trip_collaborators policies WITHOUT referencing trips table
-- This breaks the circular dependency

-- Allow users to view collaborator records they are part of
CREATE POLICY "Users can view trip collaborators" ON trip_collaborators
  FOR SELECT USING (
    trip_collaborators.user_id = auth.uid()
  );

-- For managing collaborators, we need to check if the user is the trip owner
-- We'll create a helper function that uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION is_trip_owner(trip_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trips
    WHERE id = trip_id_param
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now use this function for managing collaborators
CREATE POLICY "Trip owners can manage collaborators" ON trip_collaborators
  FOR ALL USING (
    is_trip_owner(trip_collaborators.trip_id)
  );

-- Update the trips SELECT policy to be more efficient
-- Users can see trips they own OR trips they're a collaborator on
DROP POLICY IF EXISTS "Users can view own trips" ON trips;

CREATE POLICY "Users can view own trips" ON trips
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM trip_collaborators
      WHERE trip_collaborators.trip_id = trips.id
      AND trip_collaborators.user_id = auth.uid()
    )
  );

-- Add comment explaining the solution
COMMENT ON FUNCTION is_trip_owner IS 'Helper function with SECURITY DEFINER to check trip ownership without triggering RLS recursion';
