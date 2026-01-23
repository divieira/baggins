/**
 * Test creating a trip through the actual API
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function main() {
  const testEmail = 'e2e-test@baggins.test'
  const testPassword = 'TestPassword123!'

  console.log('1. Getting test user...')
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const testUser = users?.find(u => u.email === testEmail)

  if (!testUser) {
    console.log('   Creating test user...')
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    })
    if (error) throw error
    console.log('   Created user:', newUser.user?.id)
  } else {
    console.log('   User exists:', testUser.id)
  }

  // Ensure user exists in public.users table
  console.log('\n1b. Ensuring user exists in public.users table...')
  const userId = testUser?.id || (await supabaseAdmin.auth.admin.listUsers()).data.users?.find(u => u.email === testEmail)?.id
  const { error: upsertError } = await supabaseAdmin
    .from('users')
    .upsert({
      id: userId,
      email: testEmail
    })

  if (upsertError) {
    console.log('   Error upserting user:', upsertError.message)
  } else {
    console.log('   User record ensured in public.users')
  }

  console.log('\n2. Signing in as test user...')
  const supabase = createClient(supabaseUrl, anonKey)
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  })

  if (signInError) {
    console.log('   Sign in error:', signInError.message)
    return
  }
  console.log('   Signed in as:', signIn.user?.email)

  console.log('\n3. Creating trip directly via Supabase client...')
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      user_id: signIn.user!.id,
      destination: 'Paris, France & Rome, Italy',
      start_date: '2026-03-15',
      end_date: '2026-03-22'
    })
    .select()
    .single()

  if (tripError) {
    console.log('   Trip creation error:', tripError.message)
    return
  }
  console.log('   Created trip:', trip.id)

  console.log('\n4. Creating trip_collaborator...')
  const { error: collabError } = await supabase
    .from('trip_collaborators')
    .insert({
      trip_id: trip.id,
      user_id: signIn.user!.id,
      role: 'owner'
    })

  if (collabError) {
    console.log('   Collaborator error:', collabError.message)
    return
  }
  console.log('   Created collaborator')

  console.log('\n5. Creating trip_cities...')
  const { data: cities, error: citiesError } = await supabase
    .from('trip_cities')
    .insert([
      {
        trip_id: trip.id,
        name: 'Paris, France',
        start_date: '2026-03-15',
        end_date: '2026-03-18',
        order_index: 0
      },
      {
        trip_id: trip.id,
        name: 'Rome, Italy',
        start_date: '2026-03-18',
        end_date: '2026-03-22',
        order_index: 1
      }
    ])
    .select()

  if (citiesError) {
    console.log('   Cities creation error:', citiesError.message)
    console.log('   Error details:', JSON.stringify(citiesError, null, 2))
    return
  }
  console.log('   Created cities:', cities?.length)
  cities?.forEach(c => console.log(`     - ${c.name} (${c.id})`))

  console.log('\n6. Verifying trip has cities...')
  const { data: verifyTrip, error: verifyError } = await supabase
    .from('trips')
    .select('*, trip_cities(*)')
    .eq('id', trip.id)
    .single()

  if (verifyError) {
    console.log('   Verify error:', verifyError.message)
  } else {
    console.log('   Trip verified with cities:', (verifyTrip as any).trip_cities?.length || 0)
  }

  console.log('\n✅ Test complete! Trip ID:', trip.id)
  console.log('   View at: http://localhost:3000/dashboard/trips/' + trip.id)
}

main().catch(console.error)
