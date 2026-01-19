# Apply RLS Recursion Fix

The infinite recursion error occurs because the migration hasn't been applied to your database yet. Here are three ways to apply the fix:

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
3. Copy and paste the contents of `supabase/migrations/20260119000000_fix_trips_recursion.sql`
4. Click **Run**

## Option 3: Using Supabase CLI Manually

```bash
# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Push the migration
supabase db push

# Verify the fix
supabase db execute --file supabase/test-rls-fix.sql
```

## Verify the Fix

After applying, you can verify by running the test script:

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

## What the Fix Does

The migration:

1. **Drops the problematic policies** that created circular dependencies
2. **Creates `is_trip_owner()` function** with `SECURITY DEFINER` to break the RLS chain
3. **Recreates policies** without circular references:
   - `trip_collaborators` SELECT policy only checks `user_id` directly
   - `trip_collaborators` management policy uses `is_trip_owner()` function
   - `trips` SELECT policy can safely reference `trip_collaborators` (no recursion)

## Troubleshooting

### "Migration already applied"
If you see this error, the migration may have already been applied. Run the test script to verify:
```bash
supabase db execute --file supabase/test-rls-fix.sql
```

### "Function already exists"
This is expected if you're re-running the migration. The `CREATE OR REPLACE FUNCTION` will update it.

### Still seeing recursion error
1. Verify the migration was applied: Check the Supabase dashboard → Database → Migrations
2. Clear your browser cache and reload the app
3. Check the Supabase logs for any errors

## Need Help?

If you're still experiencing issues, check:
- Supabase project logs in the dashboard
- Browser console for any errors
- Database policies in Supabase dashboard → Authentication → Policies
