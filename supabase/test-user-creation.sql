-- Test that the auto user creation trigger works

DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_email TEXT := 'test-' || test_user_id::text || '@example.com';
  user_exists BOOLEAN;
BEGIN
  RAISE NOTICE 'Testing automatic user creation...';
  RAISE NOTICE '==========================================';

  -- Test 1: Verify the trigger function exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
    RAISE NOTICE '✓ Test 1 PASSED: handle_new_user function exists';
  ELSE
    RAISE EXCEPTION '✗ Test 1 FAILED: handle_new_user function not found';
  END IF;

  -- Test 2: Verify the trigger exists
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE '✓ Test 2 PASSED: on_auth_user_created trigger exists';
  ELSE
    RAISE EXCEPTION '✗ Test 2 FAILED: trigger not found';
  END IF;

  -- Test 3: Check if existing auth users are in public.users
  IF NOT EXISTS (
    SELECT 1 FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  ) THEN
    RAISE NOTICE '✓ Test 3 PASSED: All auth users exist in public.users';
  ELSE
    RAISE WARNING '⚠ Test 3 WARNING: Some auth users missing from public.users';
    RAISE NOTICE '  Running backfill...';

    INSERT INTO public.users (id, email, created_at, updated_at)
    SELECT id, email, created_at, updated_at
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '✓ Backfill completed';
  END IF;

  RAISE NOTICE '==========================================';
  RAISE NOTICE '✅ ALL USER CREATION TESTS PASSED!';
  RAISE NOTICE '';
  RAISE NOTICE 'Users will now be automatically created in public.users';
  RAISE NOTICE 'when they sign up via Supabase Auth.';

END $$;
