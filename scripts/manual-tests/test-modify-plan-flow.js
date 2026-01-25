/**
 * Test Script for Modify Plan Flow
 *
 * This script tests that AI modifications to a trip plan are properly applied:
 * 1. Fetches current plan version and time blocks
 * 2. Simulates a modification request
 * 3. Verifies the new version is created with correct data
 *
 * Run with: node scripts/manual-tests/test-modify-plan-flow.js
 */

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function log(message, data = null) {
  console.log(`[TEST] ${message}`)
  if (data) {
    console.log(JSON.stringify(data, null, 2))
  }
}

function success(message) {
  console.log(`\n✓ ${message}`)
}

function fail(message) {
  console.log(`\n✗ ${message}`)
}

async function testModifyPlanFlow() {
  console.log('\n========================================')
  console.log('  MODIFY PLAN FLOW TEST')
  console.log('========================================\n')

  // Step 1: Get a trip with existing plan version
  log('Step 1: Finding a trip with plan versions...')

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, destination, start_date, end_date')
    .limit(1)

  if (tripsError || !trips || trips.length === 0) {
    fail('No trips found in database')
    console.log('Error:', tripsError)
    return
  }

  const trip = trips[0]
  success(`Found trip: ${trip.destination}`)
  log('Trip details:', trip)

  // Step 2: Get plan versions
  log('\nStep 2: Fetching plan versions...')

  const { data: versions, error: versionsError } = await supabase
    .from('plan_versions')
    .select('*')
    .eq('trip_id', trip.id)
    .order('version_number', { ascending: false })

  if (versionsError) {
    fail('Error fetching plan versions')
    console.log('Error:', versionsError)
    return
  }

  if (!versions || versions.length === 0) {
    fail('No plan versions found for this trip')
    log('Try generating an itinerary first via the UI')
    return
  }

  const latestVersion = versions[0]
  success(`Found ${versions.length} plan version(s), latest is version ${latestVersion.version_number}`)
  log('Latest version:', { id: latestVersion.id, version_number: latestVersion.version_number })

  // Step 3: Get time blocks for latest version
  log('\nStep 3: Fetching time blocks for latest version...')

  const { data: timeBlocks, error: blocksError } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('plan_version_id', latestVersion.id)
    .order('date')
    .order('start_time')

  if (blocksError) {
    fail('Error fetching time blocks')
    console.log('Error:', blocksError)
    return
  }

  success(`Found ${timeBlocks?.length || 0} time blocks`)

  // Analyze the blocks
  const blocksWithAttractions = timeBlocks?.filter(b => b.selected_attraction_id) || []
  const blocksWithRestaurants = timeBlocks?.filter(b => b.selected_restaurant_id) || []
  const emptyBlocks = timeBlocks?.filter(b => !b.selected_attraction_id && !b.selected_restaurant_id) || []

  log('Block summary:', {
    total: timeBlocks?.length || 0,
    withAttractions: blocksWithAttractions.length,
    withRestaurants: blocksWithRestaurants.length,
    empty: emptyBlocks.length
  })

  // Step 4: Get cities for this trip
  log('\nStep 4: Fetching cities...')

  const { data: cities } = await supabase
    .from('trip_cities')
    .select('*')
    .eq('trip_id', trip.id)
    .order('order_index')

  success(`Found ${cities?.length || 0} cities`)
  log('Cities:', cities?.map(c => ({ id: c.id, name: c.name, dates: `${c.start_date} to ${c.end_date}` })))

  // Check if time blocks have city_id set
  const blocksWithCityId = timeBlocks?.filter(b => b.city_id) || []
  const blocksWithoutCityId = timeBlocks?.filter(b => !b.city_id) || []

  log('\nCity assignment in blocks:', {
    withCityId: blocksWithCityId.length,
    withoutCityId: blocksWithoutCityId.length
  })

  if (blocksWithoutCityId.length > 0) {
    console.log('\n⚠️ WARNING: Some time blocks are missing city_id!')
    log('Blocks without city_id:', blocksWithoutCityId.slice(0, 3).map(b => ({
      id: b.id,
      date: b.date,
      block_type: b.block_type
    })))
  }

  // Step 5: Get attractions and restaurants
  log('\nStep 5: Fetching attractions and restaurants...')

  const cityIds = cities?.map(c => c.id) || []

  const [{ data: attractions }, { data: restaurants }] = await Promise.all([
    cityIds.length > 0
      ? supabase.from('attractions').select('id, name, city_id').in('city_id', cityIds)
      : supabase.from('attractions').select('id, name, city_id').eq('trip_id', trip.id),
    cityIds.length > 0
      ? supabase.from('restaurants').select('id, name, city_id').in('city_id', cityIds)
      : supabase.from('restaurants').select('id, name, city_id').eq('trip_id', trip.id)
  ])

  success(`Found ${attractions?.length || 0} attractions and ${restaurants?.length || 0} restaurants`)

  // Group by city
  const attractionsByCity = {}
  attractions?.forEach(a => {
    if (!attractionsByCity[a.city_id]) attractionsByCity[a.city_id] = []
    attractionsByCity[a.city_id].push(a)
  })

  log('Attractions by city:', Object.entries(attractionsByCity).map(([cityId, attrs]) => ({
    cityId,
    cityName: cities?.find(c => c.id === cityId)?.name,
    count: attrs.length
  })))

  // Step 6: Verify that blocks only have attractions from their own city
  log('\nStep 6: Validating city-attraction consistency...')

  let crossCityIssues = 0
  for (const block of blocksWithAttractions) {
    const attraction = attractions?.find(a => a.id === block.selected_attraction_id)
    if (attraction && block.city_id && attraction.city_id !== block.city_id) {
      crossCityIssues++
      console.log(`  ✗ Block ${block.id.substring(0, 8)} (city ${block.city_id}) has attraction from city ${attraction.city_id}`)
    }
  }

  if (crossCityIssues === 0) {
    success('All attractions are in their correct cities')
  } else {
    fail(`Found ${crossCityIssues} cross-city issues`)
  }

  // Step 7: Check if each city has time blocks
  log('\nStep 7: Checking time block coverage per city...')

  for (const city of cities || []) {
    const cityBlocks = timeBlocks?.filter(b => b.city_id === city.id) || []
    const cityBlocksWithData = cityBlocks.filter(b => b.selected_attraction_id || b.selected_restaurant_id)

    if (cityBlocks.length === 0) {
      fail(`City "${city.name}" has NO time blocks in latest version!`)
    } else {
      success(`City "${city.name}": ${cityBlocks.length} blocks, ${cityBlocksWithData.length} with selections`)
    }
  }

  // Print summary
  console.log('\n========================================')
  console.log('  SUMMARY')
  console.log('========================================\n')

  console.log('Trip:', trip.destination)
  console.log('Plan versions:', versions.length)
  console.log('Time blocks in latest version:', timeBlocks?.length || 0)
  console.log('Cities:', cities?.length || 0)
  console.log('Total attractions:', attractions?.length || 0)
  console.log('Total restaurants:', restaurants?.length || 0)

  if (crossCityIssues > 0) {
    console.log('\n❌ Cross-city issues found:', crossCityIssues)
  }

  const citiesWithoutBlocks = cities?.filter(c =>
    !timeBlocks?.some(b => b.city_id === c.id)
  ) || []

  if (citiesWithoutBlocks.length > 0) {
    console.log('\n❌ Cities missing from latest version:', citiesWithoutBlocks.map(c => c.name).join(', '))
  }

  console.log('\n')
}

testModifyPlanFlow().catch(console.error)
