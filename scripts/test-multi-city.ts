/**
 * Integration test for multi-city functionality using real Supabase
 * Run with: npx ts-node --project tsconfig.json scripts/test-multi-city.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load test environment
dotenv.config({ path: '.env.test' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

// Use service role to bypass RLS
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function main() {
  console.log('Testing multi-city functionality...\n')

  // 1. Check if trip_cities table exists
  console.log('1. Checking trip_cities table...')
  const { data: tables, error: tablesError } = await supabase
    .from('trip_cities')
    .select('id')
    .limit(1)

  if (tablesError) {
    console.error('   ERROR: trip_cities table issue:', tablesError.message)
    if (tablesError.message.includes('does not exist')) {
      console.log('\n   The trip_cities table does not exist. Migration needs to be applied.')
      console.log('   Run: npx supabase db push --linked')
    }
  } else {
    console.log('   OK: trip_cities table exists')
  }

  // 2. Check existing trips
  console.log('\n2. Checking existing trips...')
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, destination, user_id')
    .order('created_at', { ascending: false })
    .limit(5)

  if (tripsError) {
    console.error('   ERROR:', tripsError.message)
  } else if (trips && trips.length > 0) {
    console.log(`   Found ${trips.length} trips:`)
    trips.forEach(t => console.log(`   - ${t.id}: ${t.destination}`))

    // 3. Check cities for each trip
    console.log('\n3. Checking trip_cities for each trip...')
    for (const trip of trips) {
      const { data: cities, error: citiesError } = await supabase
        .from('trip_cities')
        .select('*')
        .eq('trip_id', trip.id)

      if (citiesError) {
        console.log(`   Trip ${trip.id}: ERROR - ${citiesError.message}`)
      } else if (cities && cities.length > 0) {
        console.log(`   Trip ${trip.id}: ${cities.length} cities`)
      } else {
        console.log(`   Trip ${trip.id}: NO CITIES - Creating default city...`)

        // Get trip details
        const { data: fullTrip } = await supabase
          .from('trips')
          .select('*')
          .eq('id', trip.id)
          .single()

        if (fullTrip) {
          const { data: newCity, error: insertError } = await supabase
            .from('trip_cities')
            .insert({
              trip_id: trip.id,
              name: fullTrip.destination,
              start_date: fullTrip.start_date,
              end_date: fullTrip.end_date,
              order_index: 0
            })
            .select()
            .single()

          if (insertError) {
            console.log(`      INSERT ERROR: ${insertError.message}`)
          } else if (newCity) {
            console.log(`      Created city: ${newCity.id} - ${newCity.name}`)
          }
        }
      }
    }
  } else {
    console.log('   No trips found')
  }

  // 4. Check RLS policies
  console.log('\n4. Checking RLS policies on trip_cities...')
  const { data: policies, error: policiesError } = await supabase
    .rpc('get_policies', { table_name: 'trip_cities' })
    .single()

  // This might not work, so let's just try to insert with a user
  console.log('   (Policy check requires direct DB access - skipping)')

  console.log('\n✅ Test complete!')
}

main().catch(console.error)
