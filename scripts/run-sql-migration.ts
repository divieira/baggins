/**
 * Run SQL migrations using Supabase's internal SQL execution endpoint
 */

import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('Could not extract project ref from URL')
  process.exit(1)
}

async function runSQL(sql: string, description: string) {
  console.log(`\nRunning: ${description}...`)

  // Try the SQL execution endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  })

  if (!response.ok) {
    const text = await response.text()
    console.log(`   Status: ${response.status}`)
    return false
  }

  console.log('   ✅ Success')
  return true
}

async function main() {
  console.log('Running SQL migrations on Supabase...')
  console.log(`Project: ${projectRef}`)

  // First, let's sync users which we CAN do via the API
  console.log('\n1. Syncing existing users to public.users table...')

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })

  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

  if (usersError) {
    console.log('   Error:', usersError.message)
  } else {
    for (const user of users || []) {
      const { error } = await supabase
        .from('users')
        .upsert({ id: user.id, email: user.email })

      if (error) {
        console.log(`   ❌ ${user.email}: ${error.message}`)
      } else {
        console.log(`   ✅ ${user.email}`)
      }
    }
  }

  // For the SQL migrations, we need to use Supabase Dashboard
  console.log('\n' + '='.repeat(60))
  console.log('IMPORTANT: Run the following SQL in Supabase Dashboard')
  console.log('Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql')
  console.log('='.repeat(60))

  console.log(`
-- Fix RLS policies for trip_cities INSERT
DROP POLICY IF EXISTS "Users can manage trip cities" ON trip_cities;

CREATE POLICY "Users can insert trip cities" ON trip_cities
  FOR INSERT WITH CHECK (has_trip_access(trip_id));

CREATE POLICY "Users can update trip cities" ON trip_cities
  FOR UPDATE USING (has_trip_access(trip_id));

CREATE POLICY "Users can delete trip cities" ON trip_cities
  FOR DELETE USING (has_trip_access(trip_id));

-- Add trigger to sync new users automatically
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
`)

  console.log('='.repeat(60))
  console.log('\nUsers have been synced. Please run the SQL above in Supabase Dashboard.')
}

main().catch(console.error)
