#!/usr/bin/env node
/**
 * Diagnostic script to test multi-city trip parsing
 * This helps reproduce the Santiago-Pucon issue
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.test' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userMessage = `✈️ Voos:
25/01: FLN-SCL (JetSMART JA879) | 10:50 - 14:35
28/01: SCL-ZCO (LATAM LA37) | 16:53 - 18:16
01/02: ZCO-SCL-FLN (LATAM Airlines LA32) | 11:13 - 12:35

🏨 Hotéis:
Santiago (25-28/01): APT Serviced Apartments (Las Condes)
Pucón (28/01-01/02): Hotel Montes Verdes

👥 Passageiros:
2 Adultos (Diego e Stephanie)
2 Crianças (Oliver - 3 anos e Thomas - 1 ano)`

async function testMultiCityParsing() {
  console.log('🧪 Testing Multi-City Trip Parsing\n')

  let userId, tripId

  try {
    // Create test user
    console.log('1. Creating test user...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `test-multicty-${Date.now()}@baggins.test`,
      password: 'TestPassword123!',
      email_confirm: true
    })

    if (authError) throw authError
    userId = authData.user.id
    console.log(`   ✓ User created: ${userId}\n`)

    // Call the parse-trip API
    console.log('2. Calling parse-trip API...')
    const response = await fetch('http://localhost:3000/api/ai/parse-trip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.session?.access_token || ''}`
      },
      body: JSON.stringify({ message: userMessage })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API call failed: ${response.status} ${error}`)
    }

    const result = await response.json()
    console.log(`   ✓ Trip created: ${result.trip.id}`)
    tripId = result.trip.id
    console.log(`   ✓ Parsed destination: ${result.trip.destination}`)
    console.log(`   ✓ Cities: ${result.cities.length}`)
    result.cities.forEach((city, i) => {
      console.log(`      ${i + 1}. ${city.name} (${city.start_date} to ${city.end_date})`)
    })
    console.log(`   ✓ Travelers: ${result.travelers.length}`)
    console.log(`   ✓ Flights: ${result.flights.length}`)
    console.log(`   ✓ Hotels: ${result.hotels.length}`)
    console.log(`   ✓ Total attractions generated: ${result.attractions.length}`)
    console.log(`   ✓ Total restaurants generated: ${result.restaurants.length}\n`)

    // Query attractions per city
    console.log('3. Querying attractions by city...')
    for (const city of result.cities) {
      const { data: cityAttractions, error } = await supabase
        .from('attractions')
        .select('id, name, city_id')
        .eq('city_id', city.id)

      if (error) {
        console.error(`   ✗ Error querying ${city.name}:`, error)
      } else {
        console.log(`   City: ${city.name}`)
        console.log(`      - Expected city_id: ${city.id}`)
        console.log(`      - Attractions found: ${cityAttractions.length}`)
        if (cityAttractions.length === 0) {
          console.log(`      ⚠️  WARNING: No attractions found for ${city.name}!`)

          // Check if attractions exist with null city_id
          const { data: nullAttractions } = await supabase
            .from('attractions')
            .select('id, name, city_id')
            .eq('trip_id', tripId)
            .is('city_id', null)

          if (nullAttractions && nullAttractions.length > 0) {
            console.log(`      ⚠️  Found ${nullAttractions.length} attractions with city_id=NULL!`)
            console.log(`      This is the bug! Attractions were created without city_id.`)
          }
        } else {
          cityAttractions.slice(0, 3).forEach(attr => {
            console.log(`         • ${attr.name} (city_id: ${attr.city_id})`)
          })
          if (cityAttractions.length > 3) {
            console.log(`         ... and ${cityAttractions.length - 3} more`)
          }
        }
      }
    }
    console.log()

    // Check for attractions with null city_id
    console.log('4. Checking for orphaned attractions (city_id=NULL)...')
    const { data: orphanedAttractions } = await supabase
      .from('attractions')
      .select('id, name, city_id, trip_id')
      .eq('trip_id', tripId)
      .is('city_id', null)

    if (orphanedAttractions && orphanedAttractions.length > 0) {
      console.log(`   ⚠️  Found ${orphanedAttractions.length} orphaned attractions!`)
      orphanedAttractions.forEach(attr => {
        console.log(`      • ${attr.name} (city_id: NULL)`)
      })
      console.log()
      console.log('   🐛 BUG REPRODUCED: Attractions created without city_id')
      console.log('   This is why they don\'t show up in the UI!')
    } else {
      console.log('   ✓ No orphaned attractions found')
    }
    console.log()

    console.log('✅ Diagnosis complete\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  } finally {
    // Cleanup
    if (tripId) {
      console.log('5. Cleaning up test data...')
      await supabase.from('time_blocks').delete().eq('trip_id', tripId)
      await supabase.from('attractions').delete().eq('trip_id', tripId)
      await supabase.from('restaurants').delete().eq('trip_id', tripId)
      await supabase.from('hotels').delete().eq('trip_id', tripId)
      await supabase.from('trip_cities').delete().eq('trip_id', tripId)
      await supabase.from('flights').delete().eq('trip_id', tripId)
      await supabase.from('travelers').delete().eq('trip_id', tripId)
      await supabase.from('trip_collaborators').delete().eq('trip_id', tripId)
      await supabase.from('trips').delete().eq('id', tripId)
      console.log('   ✓ Trip deleted\n')
    }

    if (userId) {
      await supabase.auth.admin.deleteUser(userId)
      console.log('   ✓ Test user deleted\n')
    }
  }
}

// Run if called directly
if (require.main === module) {
  testMultiCityParsing()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = { testMultiCityParsing }
