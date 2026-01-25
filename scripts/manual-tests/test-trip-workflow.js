/**
 * Manual Test Script for Trip Workflows
 *
 * This script tests the complete trip workflow:
 * 1. Trip data integrity
 * 2. Attraction-city matching
 * 3. Time block validation
 * 4. Hotel data
 *
 * Run with: node scripts/manual-tests/test-trip-workflow.js
 *
 * NOTE: Requires a running database and valid environment variables
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

const results = []

function log(message) {
  console.log(`[TEST] ${message}`)
}

function logResult(result) {
  results.push(result)
  const status = result.passed ? '✓' : '✗'
  console.log(`\n${status} ${result.test}`)
  console.log(`  ${result.details}`)
  if (result.data) {
    console.log('  Data:', JSON.stringify(result.data, null, 2).substring(0, 500))
  }
}

async function testDatabaseConnection() {
  log('Testing database connection...')

  const { data, error } = await supabase.from('trips').select('count').limit(1)

  if (error) {
    logResult({
      test: 'Database Connection',
      passed: false,
      details: `Connection failed: ${error.message}`
    })
    return false
  }

  logResult({
    test: 'Database Connection',
    passed: true,
    details: 'Successfully connected to database'
  })
  return true
}

async function testExistingTrips() {
  log('Checking existing trips...')

  const { data: trips, error } = await supabase
    .from('trips')
    .select(`
      id,
      destination,
      start_date,
      end_date,
      trip_cities (
        id,
        name,
        start_date,
        end_date
      )
    `)
    .limit(5)

  if (error) {
    logResult({
      test: 'Fetch Existing Trips',
      passed: false,
      details: `Failed to fetch trips: ${error.message}`
    })
    return
  }

  logResult({
    test: 'Fetch Existing Trips',
    passed: true,
    details: `Found ${trips?.length || 0} trips`,
    data: trips?.map(t => ({ destination: t.destination, cities: t.trip_cities?.map(c => c.name) }))
  })

  // Test each trip for data integrity
  for (const trip of trips || []) {
    await testTripDataIntegrity(trip)
  }
}

async function testTripDataIntegrity(trip) {
  log(`Testing trip integrity: ${trip.destination}`)

  const cities = trip.trip_cities || []

  // Check if cities exist
  if (cities.length === 0) {
    logResult({
      test: `Trip "${trip.destination}" - City Data`,
      passed: false,
      details: 'No cities found for this trip'
    })
    return
  }

  // Check that city dates don't overlap incorrectly
  const sortedCities = [...cities].sort((a, b) => a.start_date.localeCompare(b.start_date))
  let datesValid = true
  for (let i = 0; i < sortedCities.length - 1; i++) {
    const current = sortedCities[i]
    const next = sortedCities[i + 1]
    if (current.end_date > next.start_date) {
      datesValid = false
      break
    }
  }

  logResult({
    test: `Trip "${trip.destination}" - City Dates`,
    passed: datesValid,
    details: datesValid
      ? `${cities.length} cities with valid date ranges`
      : 'City dates overlap incorrectly'
  })

  // Check attractions for each city
  for (const city of cities) {
    await testCityAttractions(trip.id, city)
  }
}

async function testCityAttractions(tripId, city) {
  const { data: attractions, error } = await supabase
    .from('attractions')
    .select('id, name, city_id')
    .eq('city_id', city.id)

  if (error) {
    logResult({
      test: `City "${city.name}" - Attractions Query`,
      passed: false,
      details: `Query failed: ${error.message}`
    })
    return
  }

  // Check all attractions have correct city_id
  const allCorrectCity = (attractions || []).every(a => a.city_id === city.id)

  logResult({
    test: `City "${city.name}" - Attractions`,
    passed: allCorrectCity,
    details: `${attractions?.length || 0} attractions, all with correct city_id: ${allCorrectCity}`
  })
}

async function testTimeBlocksIntegrity() {
  log('Testing time blocks integrity...')

  // Get time blocks with their city and attraction info
  const { data: timeBlocks, error } = await supabase
    .from('time_blocks')
    .select(`
      id,
      date,
      city_id,
      block_type,
      selected_attraction_id,
      selected_restaurant_id
    `)
    .not('selected_attraction_id', 'is', null)
    .limit(50)

  if (error) {
    logResult({
      test: 'Time Blocks Query',
      passed: false,
      details: `Query failed: ${error.message}`
    })
    return
  }

  let mismatches = 0
  const issues = []

  for (const block of timeBlocks || []) {
    if (block.selected_attraction_id) {
      // Check that attraction belongs to the same city
      const { data: attraction } = await supabase
        .from('attractions')
        .select('id, name, city_id')
        .eq('id', block.selected_attraction_id)
        .single()

      if (attraction && block.city_id && attraction.city_id !== block.city_id) {
        mismatches++
        issues.push(`Block ${block.id}: attraction from city ${attraction.city_id}, block in city ${block.city_id}`)
      }
    }
  }

  logResult({
    test: 'Time Blocks - City Matching',
    passed: mismatches === 0,
    details: mismatches === 0
      ? `Checked ${timeBlocks?.length || 0} time blocks, all attractions match their city`
      : `Found ${mismatches} mismatches: ${issues.slice(0, 3).join('; ')}`
  })
}

async function testTimeBlockOrder() {
  log('Testing time block ordering...')

  // Get time blocks grouped by date
  const { data: timeBlocks, error } = await supabase
    .from('time_blocks')
    .select('id, date, block_type, start_time')
    .order('date')
    .order('start_time')
    .limit(100)

  if (error) {
    logResult({
      test: 'Time Block Order Query',
      passed: false,
      details: `Query failed: ${error.message}`
    })
    return
  }

  // Group by date and check order
  const blocksByDate = {}
  for (const block of timeBlocks || []) {
    if (!blocksByDate[block.date]) {
      blocksByDate[block.date] = []
    }
    blocksByDate[block.date].push(block)
  }

  const expectedOrder = ['morning', 'lunch', 'afternoon', 'dinner', 'evening']
  let orderIssues = 0
  const issues = []

  for (const [date, blocks] of Object.entries(blocksByDate)) {
    for (let i = 0; i < blocks.length - 1; i++) {
      const currentIdx = expectedOrder.indexOf(blocks[i].block_type)
      const nextIdx = expectedOrder.indexOf(blocks[i + 1].block_type)
      if (currentIdx >= nextIdx) {
        orderIssues++
        issues.push(`${date}: ${blocks[i].block_type} before ${blocks[i + 1].block_type}`)
      }
    }
  }

  logResult({
    test: 'Time Blocks - Order',
    passed: orderIssues === 0,
    details: orderIssues === 0
      ? `Checked ${Object.keys(blocksByDate).length} days, all in correct order`
      : `Found ${orderIssues} order issues: ${issues.slice(0, 3).join('; ')}`
  })
}

async function testHotelsExist() {
  log('Testing hotels data...')

  const { data: hotels, error } = await supabase
    .from('hotels')
    .select(`
      id,
      name,
      city_id,
      check_in_date,
      check_out_date,
      latitude,
      longitude
    `)
    .limit(10)

  if (error) {
    logResult({
      test: 'Hotels Query',
      passed: false,
      details: `Query failed: ${error.message}`
    })
    return
  }

  const hotelsWithDates = (hotels || []).filter(h => h.check_in_date && h.check_out_date)
  const hotelsWithLocation = (hotels || []).filter(h => h.latitude && h.longitude)

  logResult({
    test: 'Hotels Data',
    passed: true,
    details: `${hotels?.length || 0} hotels: ${hotelsWithDates.length} with dates, ${hotelsWithLocation.length} with location`,
    data: hotels?.slice(0, 3).map(h => ({ name: h.name, check_in: h.check_in_date, check_out: h.check_out_date }))
  })
}

async function testPlanVersions() {
  log('Testing plan versions...')

  const { data: versions, error } = await supabase
    .from('plan_versions')
    .select(`
      id,
      trip_id,
      version_number,
      plan_data,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    logResult({
      test: 'Plan Versions Query',
      passed: false,
      details: `Query failed: ${error.message}`
    })
    return
  }

  logResult({
    test: 'Plan Versions',
    passed: true,
    details: `Found ${versions?.length || 0} recent plan versions`,
    data: versions?.map(v => ({ id: v.id.substring(0, 8), version: v.version_number }))
  })
}

async function testItineraryDistribution() {
  log('Testing itinerary distribution...')

  // Get trips with time blocks
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, destination, start_date, end_date')
    .limit(3)

  if (tripsError) {
    logResult({
      test: 'Itinerary Distribution',
      passed: false,
      details: `Failed to fetch trips: ${tripsError.message}`
    })
    return
  }

  for (const trip of trips || []) {
    // Get the latest plan version
    const { data: version } = await supabase
      .from('plan_versions')
      .select('id')
      .eq('trip_id', trip.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    if (!version) continue

    // Get time blocks for this version
    const { data: blocks } = await supabase
      .from('time_blocks')
      .select('date, selected_attraction_id, selected_restaurant_id')
      .eq('plan_version_id', version.id)
      .order('date')

    if (!blocks || blocks.length === 0) continue

    // Check distribution
    const datesWithActivity = new Set()
    for (const block of blocks) {
      if (block.selected_attraction_id || block.selected_restaurant_id) {
        datesWithActivity.add(block.date)
      }
    }

    const uniqueDates = [...new Set(blocks.map(b => b.date))]
    const coverage = (datesWithActivity.size / uniqueDates.length * 100).toFixed(0)
    const firstDay = uniqueDates[0]
    const hasFirstDayActivity = datesWithActivity.has(firstDay)

    logResult({
      test: `Trip "${trip.destination}" - Activity Distribution`,
      passed: hasFirstDayActivity && datesWithActivity.size > uniqueDates.length / 2,
      details: `${datesWithActivity.size}/${uniqueDates.length} days have activities (${coverage}%). First day has activity: ${hasFirstDayActivity}`
    })
  }
}

async function runAllTests() {
  console.log('\n========================================')
  console.log('  BAGGINS MANUAL TEST SUITE')
  console.log('========================================\n')

  const connected = await testDatabaseConnection()

  if (!connected) {
    console.log('\n❌ Cannot proceed without database connection')
    return
  }

  await testExistingTrips()
  await testTimeBlocksIntegrity()
  await testTimeBlockOrder()
  await testHotelsExist()
  await testPlanVersions()
  await testItineraryDistribution()

  // Print summary
  console.log('\n========================================')
  console.log('  TEST SUMMARY')
  console.log('========================================\n')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`Total: ${results.length} tests`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)

  if (failed > 0) {
    console.log('\nFailed tests:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}: ${r.details}`)
    })
  }

  console.log('\n')
}

runAllTests().catch(console.error)
