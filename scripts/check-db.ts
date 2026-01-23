/**
 * Check database state with service role key (bypasses RLS)
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
  console.log('Checking database with service role key (bypasses RLS)...\n')

  // Get all trips
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false })

  console.log('TRIPS:')
  if (tripsError) {
    console.log('  Error:', tripsError.message)
  } else if (!trips || trips.length === 0) {
    console.log('  No trips found')
  } else {
    console.log(`  Found ${trips.length} trips:`)
    for (const trip of trips) {
      console.log(`  - ID: ${trip.id}`)
      console.log(`    Destination: ${trip.destination}`)
      console.log(`    Dates: ${trip.start_date} to ${trip.end_date}`)
      console.log(`    User ID: ${trip.user_id}`)
      console.log('')
    }
  }

  // Get all trip_cities
  console.log('\nTRIP_CITIES:')
  const { data: cities, error: citiesError } = await supabase
    .from('trip_cities')
    .select('*')
    .order('created_at', { ascending: false })

  if (citiesError) {
    console.log('  Error:', citiesError.message)
  } else if (!cities || cities.length === 0) {
    console.log('  No cities found')
  } else {
    console.log(`  Found ${cities.length} cities:`)
    for (const city of cities) {
      console.log(`  - ID: ${city.id}`)
      console.log(`    Trip ID: ${city.trip_id}`)
      console.log(`    Name: ${city.name}`)
      console.log(`    Dates: ${city.start_date} to ${city.end_date}`)
      console.log('')
    }
  }

  // Get all users
  console.log('\nUSERS (from auth):')
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

  if (usersError) {
    console.log('  Error:', usersError.message)
  } else if (!users || users.length === 0) {
    console.log('  No users found')
  } else {
    console.log(`  Found ${users.length} users:`)
    for (const user of users) {
      console.log(`  - ${user.id}: ${user.email}`)
    }
  }

  // Get trip_collaborators
  console.log('\nTRIP_COLLABORATORS:')
  const { data: collaborators, error: collabError } = await supabase
    .from('trip_collaborators')
    .select('*')

  if (collabError) {
    console.log('  Error:', collabError.message)
  } else if (!collaborators || collaborators.length === 0) {
    console.log('  No collaborators found')
  } else {
    console.log(`  Found ${collaborators.length} collaborators:`)
    for (const c of collaborators) {
      console.log(`  - Trip: ${c.trip_id}, User: ${c.user_id}, Role: ${c.role}`)
    }
  }
}

main().catch(console.error)
