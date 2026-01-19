-- End-to-End Test for Trips RLS Policy Fix
-- This script tests that the infinite recursion issue is resolved

-- Test 1: Verify the is_trip_owner function exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_trip_owner'
  ) THEN
    RAISE NOTICE '✓ Test 1 PASSED: is_trip_owner function exists';
  ELSE
    RAISE EXCEPTION '✗ Test 1 FAILED: is_trip_owner function does not exist';
  END IF;
END $$;

-- Test 2: Verify trip_collaborators policies are correct
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'trip_collaborators'
  AND policyname IN ('Users can view trip collaborators', 'Trip owners can manage collaborators');

  IF policy_count = 2 THEN
    RAISE NOTICE '✓ Test 2 PASSED: trip_collaborators policies exist';
  ELSE
    RAISE EXCEPTION '✗ Test 2 FAILED: Expected 2 policies, found %', policy_count;
  END IF;
END $$;

-- Test 3: Verify trips policies exist
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'trips'
  AND policyname = 'Users can view own trips';

  IF policy_count = 1 THEN
    RAISE NOTICE '✓ Test 3 PASSED: trips SELECT policy exists';
  ELSE
    RAISE EXCEPTION '✗ Test 3 FAILED: trips SELECT policy not found';
  END IF;
END $$;

-- Test 4: Create test user and verify no recursion
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_trip_id UUID := gen_random_uuid();
BEGIN
  -- Set up test user context
  PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);

  -- Create a test trip
  INSERT INTO trips (id, user_id, destination, start_date, end_date)
  VALUES (test_trip_id, test_user_id, 'Test Destination', '2026-01-20', '2026-01-22');

  -- Create a collaborator record
  INSERT INTO trip_collaborators (trip_id, user_id, role)
  VALUES (test_trip_id, test_user_id, 'owner');

  -- Try to query trips (this would cause infinite recursion if not fixed)
  PERFORM * FROM trips WHERE id = test_trip_id;

  -- Try to query trip_collaborators
  PERFORM * FROM trip_collaborators WHERE trip_id = test_trip_id;

  -- Clean up
  DELETE FROM trip_collaborators WHERE trip_id = test_trip_id;
  DELETE FROM trips WHERE id = test_trip_id;

  RAISE NOTICE '✓ Test 4 PASSED: No infinite recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    -- Clean up on error
    DELETE FROM trip_collaborators WHERE trip_id = test_trip_id;
    DELETE FROM trips WHERE id = test_trip_id;
    RAISE EXCEPTION '✗ Test 4 FAILED: %', SQLERRM;
END $$;

-- Test 5: Verify policy definitions don't create circular dependency
DO $$
DECLARE
  collaborator_policy TEXT;
  trips_policy TEXT;
BEGIN
  -- Get trip_collaborators SELECT policy definition
  SELECT qual::text INTO collaborator_policy
  FROM pg_policies
  WHERE tablename = 'trip_collaborators'
  AND policyname = 'Users can view trip collaborators'
  AND cmd = 'SELECT';

  -- Check that it doesn't reference trips table
  IF collaborator_policy NOT LIKE '%trips%' THEN
    RAISE NOTICE '✓ Test 5a PASSED: trip_collaborators policy does not reference trips table';
  ELSE
    RAISE WARNING '✗ Test 5a WARNING: trip_collaborators policy references trips table: %', collaborator_policy;
  END IF;

  -- Get trip_collaborators management policy
  SELECT qual::text INTO collaborator_policy
  FROM pg_policies
  WHERE tablename = 'trip_collaborators'
  AND policyname = 'Trip owners can manage collaborators';

  -- Check that it uses the is_trip_owner function
  IF collaborator_policy LIKE '%is_trip_owner%' THEN
    RAISE NOTICE '✓ Test 5b PASSED: management policy uses is_trip_owner function';
  ELSE
    RAISE WARNING '✗ Test 5b WARNING: management policy does not use is_trip_owner: %', collaborator_policy;
  END IF;
END $$;

RAISE NOTICE '==========================================';
RAISE NOTICE 'All tests completed!';
RAISE NOTICE 'If all tests passed, the RLS recursion fix is working correctly.';
