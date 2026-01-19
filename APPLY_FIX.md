# Apply Database Fixes

Two database migrations need to be applied to fix the errors you're seeing:

1. **RLS Recursion Fix** - Fixes "infinite recursion detected in policy for relation 'trips'"
2. **Auto User Creation** - Fixes "violates foreign key constraint 'trips_user_id_fkey'"

Here are three ways to apply both fixes:

## Option 1: Using Supabase CLI (Recommended)

```bash
# Make the script executable
chmod +x apply-rls-fix.sh

# Run the script
./apply-rls-fix.sh
```

This will:
1. Apply the migration
2. Run verification tests
3. Confirm the fix is working

## Option 2: Using Supabase Dashboard (Manual)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run **Migration 1** - Copy and paste the contents of:
   `supabase/migrations/20260119000000_fix_trips_recursion.sql`
   Click **Run**
4. Run **Migration 2** - Copy and paste the contents of:
   `supabase/migrations/20260119000001_auto_create_users.sql`
   Click **Run**

## Option 3: Using Supabase CLI Manually

```bash
# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Push the migration
supabase db push

# Verify the fix
supabase db execute --file supabase/test-rls-fix.sql
```

## Verify the Fixes

After applying both migrations, verify they work:

### Test 1: RLS Fix
```bash
supabase db execute --file supabase/test-rls-fix.sql
```

You should see:
```
✓ Test 1 PASSED: is_trip_owner function exists
✓ Test 2 PASSED: trip_collaborators policies exist
✓ Test 3 PASSED: trips SELECT policy exists
✓ Test 4 PASSED: No infinite recursion detected
✓ Test 5a PASSED: trip_collaborators policy does not reference trips table
✓ Test 5b PASSED: management policy uses is_trip_owner function
```

### Test 2: User Creation
```bash
supabase db execute --file supabase/test-user-creation.sql
```

You should see:
```
✓ Test 1 PASSED: handle_new_user function exists
✓ Test 2 PASSED: on_auth_user_created trigger exists
✓ Test 3 PASSED: All auth users exist in public.users
```

### Test 3: Complete Flow
```bash
supabase db execute --file supabase/test-complete-flow.sql
```

This tests the entire trip creation workflow end-to-end.

## What the Fixes Do

### Migration 1: RLS Recursion Fix (`20260119000000_fix_trips_recursion.sql`)

1. **Drops the problematic policies** that created circular dependencies
2. **Creates `is_trip_owner()` function** with `SECURITY DEFINER` to break the RLS chain
3. **Recreates policies** without circular references:
   - `trip_collaborators` SELECT policy only checks `user_id` directly
   - `trip_collaborators` management policy uses `is_trip_owner()` function
   - `trips` SELECT policy can safely reference `trip_collaborators` (no recursion)

### Migration 2: Auto User Creation (`20260119000001_auto_create_users.sql`)

1. **Creates `handle_new_user()` trigger function** to automatically create user records
2. **Sets up automatic trigger** on `auth.users` table
3. **Backfills existing users** from `auth.users` to `public.users`
4. **Prevents foreign key errors** when creating trips

## Troubleshooting

### "Migration already applied"
If you see this error, the migration may have already been applied. Run the test script to verify:
```bash
supabase db execute --file supabase/test-rls-fix.sql
```

### "Function already exists"
This is expected if you're re-running the migration. The `CREATE OR REPLACE FUNCTION` will update it.

### Still seeing recursion error
1. Verify migration 1 was applied: Check the Supabase dashboard → Database → Migrations
2. Clear your browser cache and reload the app
3. Check the Supabase logs for any errors

### "violates foreign key constraint 'trips_user_id_fkey'"
This means migration 2 hasn't been applied yet. This migration creates users automatically.

**Quick fix:**
```bash
supabase db execute --file supabase/migrations/20260119000001_auto_create_users.sql
supabase db execute --file supabase/test-user-creation.sql
```

Or run the backfill manually in SQL Editor:
```sql
INSERT INTO public.users (id, email, created_at, updated_at)
SELECT id, email, created_at, updated_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

## Need Help?

If you're still experiencing issues, check:
- Supabase project logs in the dashboard
- Browser console for any errors
- Database policies in Supabase dashboard → Authentication → Policies
