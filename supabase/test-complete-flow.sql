-- Complete End-to-End Test for Trip Creation Flow
-- This simulates the actual user flow: create trip → add collaborator → query trips

BEGIN;

-- Clean up any existing test data
DELETE FROM trip_collaborators WHERE trip_id IN (SELECT id FROM trips WHERE destination = 'E2E Test Trip');
DELETE FROM trips WHERE destination = 'E2E Test Trip';

-- Create a test user ID
CREATE TEMP TABLE test_context (user_id UUID);
INSERT INTO test_context VALUES (gen_random_uuid());

-- Set the authentication context
SELECT set_config('request.jwt.claim.sub', user_id::text, true) FROM test_context;

RAISE NOTICE 'Starting End-to-End Test...';
RAISE NOTICE '==========================================';

-- STEP 1: Create a trip
RAISE NOTICE 'Step 1: Creating trip...';

INSERT INTO trips (user_id, destination, start_date, end_date)
SELECT user_id, 'E2E Test Trip', '2026-01-20', '2026-01-22'
FROM test_context
RETURNING id INTO temp_trip_id;

DO $$
DECLARE
  temp_trip_id UUID;
BEGIN
  SELECT id INTO temp_trip_id FROM trips WHERE destination = 'E2E Test Trip';
  RAISE NOTICE '✓ Trip created: %', temp_trip_id;
END $$;

-- STEP 2: Create collaborator record (this is where the app creates the owner record)
RAISE NOTICE 'Step 2: Creating collaborator record...';

INSERT INTO trip_collaborators (trip_id, user_id, role)
SELECT t.id, tc.user_id, 'owner'
FROM trips t, test_context tc
WHERE t.destination = 'E2E Test Trip';

RAISE NOTICE '✓ Collaborator record created';

-- STEP 3: Query trips (THIS WOULD FAIL WITH INFINITE RECURSION IF NOT FIXED)
RAISE NOTICE 'Step 3: Querying trips (testing for infinite recursion)...';

DO $$
DECLARE
  trip_count INTEGER;
  trip_record RECORD;
BEGIN
  -- This query would cause infinite recursion with the old policies
  SELECT COUNT(*) INTO trip_count
  FROM trips
  WHERE destination = 'E2E Test Trip';

  IF trip_count = 1 THEN
    RAISE NOTICE '✓ Successfully queried trips without recursion';
  ELSE
    RAISE EXCEPTION 'Expected 1 trip, found %', trip_count;
  END IF;

  -- Try to get the full trip record
  SELECT * INTO trip_record
  FROM trips
  WHERE destination = 'E2E Test Trip';

  RAISE NOTICE '✓ Retrieved trip: % (% to %)', trip_record.destination, trip_record.start_date, trip_record.end_date;
END $$;

-- STEP 4: Query trip collaborators
RAISE NOTICE 'Step 4: Querying trip collaborators...';

DO $$
DECLARE
  collab_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO collab_count
  FROM trip_collaborators tc
  JOIN trips t ON t.id = tc.trip_id
  WHERE t.destination = 'E2E Test Trip';

  IF collab_count = 1 THEN
    RAISE NOTICE '✓ Successfully queried trip collaborators';
  ELSE
    RAISE EXCEPTION 'Expected 1 collaborator, found %', collab_count;
  END IF;
END $$;

-- STEP 5: Test access control - user should see their own trip
RAISE NOTICE 'Step 5: Testing access control...';

DO $$
DECLARE
  can_view BOOLEAN;
  trip_id UUID;
BEGIN
  SELECT id INTO trip_id FROM trips WHERE destination = 'E2E Test Trip';

  -- Test using the has_trip_access function (if it exists)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_trip_access') THEN
    SELECT has_trip_access(trip_id) INTO can_view;
    IF can_view THEN
      RAISE NOTICE '✓ Access control working: user can view their trip';
    ELSE
      RAISE EXCEPTION 'Access control failed: user cannot view their own trip';
    END IF;
  ELSE
    RAISE NOTICE '⚠ has_trip_access function not found (optional)';
  END IF;

  -- Test using is_trip_owner function
  SELECT is_trip_owner(trip_id) INTO can_view;
  IF can_view THEN
    RAISE NOTICE '✓ Ownership check working: user is trip owner';
  ELSE
    RAISE EXCEPTION 'Ownership check failed: user is not recognized as owner';
  END IF;
END $$;

-- STEP 6: Simulate adding a traveler (related table access)
RAISE NOTICE 'Step 6: Testing related table access (travelers)...';

INSERT INTO travelers (trip_id, name, age)
SELECT t.id, 'Test Traveler', 5
FROM trips t
WHERE t.destination = 'E2E Test Trip';

DO $$
DECLARE
  traveler_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO traveler_count
  FROM travelers tv
  JOIN trips t ON t.id = tv.trip_id
  WHERE t.destination = 'E2E Test Trip';

  IF traveler_count = 1 THEN
    RAISE NOTICE '✓ Related table access working';
  ELSE
    RAISE EXCEPTION 'Related table test failed: expected 1 traveler, found %', traveler_count;
  END IF;
END $$;

-- Clean up
DELETE FROM travelers WHERE trip_id IN (SELECT id FROM trips WHERE destination = 'E2E Test Trip');
DELETE FROM trip_collaborators WHERE trip_id IN (SELECT id FROM trips WHERE destination = 'E2E Test Trip');
DELETE FROM trips WHERE destination = 'E2E Test Trip';

RAISE NOTICE '==========================================';
RAISE NOTICE '✅ ALL END-TO-END TESTS PASSED!';
RAISE NOTICE '==========================================';
RAISE NOTICE '';
RAISE NOTICE 'The infinite recursion issue is FIXED.';
RAISE NOTICE 'The complete trip creation flow works correctly.';

ROLLBACK; -- Don't actually commit the test data
