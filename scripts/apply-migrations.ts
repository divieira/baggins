/**
 * Apply migrations to production Supabase using service role key
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function main() {
  console.log('Applying migrations to production Supabase...\n')

  // Migration 1: Fix RLS policies for trip_cities
  console.log('1. Fixing RLS policies for trip_cities...')

  const { error: error1 } = await supabase.rpc('exec_sql', {
    sql: `
      -- Drop the old policy if it exists
      DROP POLICY IF EXISTS "Users can manage trip cities" ON trip_cities;

      -- Create separate policies for each operation
      DROP POLICY IF EXISTS "Users can insert trip cities" ON trip_cities;
      CREATE POLICY "Users can insert trip cities" ON trip_cities
        FOR INSERT WITH CHECK (has_trip_access(trip_id));

      DROP POLICY IF EXISTS "Users can update trip cities" ON trip_cities;
      CREATE POLICY "Users can update trip cities" ON trip_cities
        FOR UPDATE USING (has_trip_access(trip_id));

      DROP POLICY IF EXISTS "Users can delete trip cities" ON trip_cities;
      CREATE POLICY "Users can delete trip cities" ON trip_cities
        FOR DELETE USING (has_trip_access(trip_id));
    `
  })

  if (error1) {
    console.log('   Note: RPC exec_sql not available, trying direct approach...')

    // Try using the REST API to execute SQL won't work directly
    // We need to use the postgres connection or Dashboard
    console.log('   Cannot execute raw SQL via REST API.')
    console.log('   Please run the following SQL in Supabase Dashboard SQL Editor:\n')

    console.log(`
-- Migration 1: Fix RLS policies
DROP POLICY IF EXISTS "Users can manage trip cities" ON trip_cities;

CREATE POLICY "Users can insert trip cities" ON trip_cities
  FOR INSERT WITH CHECK (has_trip_access(trip_id));

CREATE POLICY "Users can update trip cities" ON trip_cities
  FOR UPDATE USING (has_trip_access(trip_id));

CREATE POLICY "Users can delete trip cities" ON trip_cities
  FOR DELETE USING (has_trip_access(trip_id));

-- Migration 2: Sync auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    `)

    // But we CAN sync users via the API
    console.log('\n2. Syncing existing users via API...')

    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      console.log('   Error listing users:', usersError.message)
      return
    }

    for (const user of users || []) {
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({ id: user.id, email: user.email })

      if (upsertError) {
        console.log(`   Error syncing ${user.email}:`, upsertError.message)
      } else {
        console.log(`   ✅ Synced: ${user.email}`)
      }
    }

    return
  }

  console.log('   ✅ RLS policies updated')

  // Migration 2: Add trigger for syncing users
  console.log('\n2. Adding user sync trigger...')

  const { error: error2 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.users (id, email)
        VALUES (NEW.id, NEW.email)
        ON CONFLICT (id) DO UPDATE SET email = NEW.email;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `
  })

  if (error2) {
    console.log('   Error:', error2.message)
  } else {
    console.log('   ✅ User sync trigger created')
  }

  // Backfill existing users
  console.log('\n3. Backfilling existing users...')

  const { data: { users } } = await supabase.auth.admin.listUsers()

  for (const user of users || []) {
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({ id: user.id, email: user.email })

    if (upsertError) {
      console.log(`   Error syncing ${user.email}:`, upsertError.message)
    } else {
      console.log(`   ✅ Synced: ${user.email}`)
    }
  }

  console.log('\n✅ All migrations applied!')
}

main().catch(console.error)
