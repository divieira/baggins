import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

interface CityDetails {
  name: string
  start_date: string
  end_date: string
  hotel?: {
    name: string
    address: string
    latitude?: number
    longitude?: number
  }
}

interface TripDetails {
  destination: string  // Primary destination (for backwards compatibility)
  start_date: string   // Overall trip start
  end_date: string     // Overall trip end
  cities: CityDetails[]  // Multi-city support
  travelers: Array<{
    name: string
    age?: number
    relation?: string
  }>
  flights?: Array<{
    airline: string
    flight_number: string
    departure_time: string
    arrival_time: string
    from_location: string
    to_location: string
    date: string
  }>
}

export async function POST(request: Request) {
  try {
    const { message, tripId } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured. Please set ANTHROPIC_API_KEY in your environment variables.' },
        { status: 500 }
      )
    }

    // Use Claude to parse the message and extract trip details
    const aiMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: `You are a trip details parser. Extract structured trip information from user messages.

Instructions:
- Extract destination(s), dates, travelers, flights, and hotels if mentioned
- IMPORTANT: Support multi-city trips! If user mentions multiple cities, extract each with its own dates
- Use ISO date format (YYYY-MM-DD) for dates
- If year is not mentioned, assume current year (2026)
- For travelers, extract names, ages, and relationships if provided
- For flights, extract airline, flight number, times, and locations
- For hotels, include approximate coordinates (latitude, longitude) if you know the city
- If information is partial or missing, include what you can extract
- Return ONLY valid JSON, no additional text

Example output for multi-city trip:
{
  "destination": "Paris, France & Rome, Italy",
  "start_date": "2026-03-15",
  "end_date": "2026-03-22",
  "cities": [
    {
      "name": "Paris, France",
      "start_date": "2026-03-15",
      "end_date": "2026-03-18",
      "hotel": {
        "name": "Hotel Eiffel",
        "address": "123 Rue de la Paix, Paris",
        "latitude": 48.8566,
        "longitude": 2.3522
      }
    },
    {
      "name": "Rome, Italy",
      "start_date": "2026-03-18",
      "end_date": "2026-03-22",
      "hotel": {
        "name": "Hotel Roma",
        "address": "Via Condotti, Rome",
        "latitude": 41.9028,
        "longitude": 12.4964
      }
    }
  ],
  "travelers": [
    {"name": "John", "relation": "self"},
    {"name": "Jane", "age": 35, "relation": "wife"},
    {"name": "Tommy", "age": 8, "relation": "son"}
  ],
  "flights": [
    {
      "airline": "Air France",
      "flight_number": "AF123",
      "departure_time": "10:00",
      "arrival_time": "14:30",
      "from_location": "JFK",
      "to_location": "CDG",
      "date": "2026-03-15"
    }
  ]
}

For single-city trips, still include the "cities" array with one entry.`,
      messages: [
        { role: 'user', content: message }
      ]
    })

    const content = aiMessage.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    let tripDetails: TripDetails
    try {
      // Extract JSON from the response (handle cases where Claude adds extra text)
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      tripDetails = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse AI response:', content.text)
      throw new Error('Failed to parse trip details from message')
    }

    // Validate required fields
    if (!tripDetails.destination || !tripDetails.start_date || !tripDetails.end_date) {
      return NextResponse.json({
        error: 'Could not extract required trip details (destination and dates). Please provide more information.',
        partial: tripDetails
      }, { status: 400 })
    }

    // Ensure cities array exists
    if (!tripDetails.cities || tripDetails.cities.length === 0) {
      // Create a single city from the destination
      tripDetails.cities = [{
        name: tripDetails.destination,
        start_date: tripDetails.start_date,
        end_date: tripDetails.end_date
      }]
    }

    // Create or update trip
    let trip
    if (tripId) {
      // Update existing trip
      const { data, error } = await supabase
        .from('trips')
        .update({
          destination: tripDetails.destination,
          start_date: tripDetails.start_date,
          end_date: tripDetails.end_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', tripId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      trip = data
    } else {
      // Create new trip
      const { data, error } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          destination: tripDetails.destination,
          start_date: tripDetails.start_date,
          end_date: tripDetails.end_date
        })
        .select()
        .single()

      if (error) throw error
      trip = data

      // Create collaborator record for the owner
      await supabase
        .from('trip_collaborators')
        .insert({
          trip_id: trip.id,
          user_id: user.id,
          role: 'owner'
        })
    }

    // Delete existing cities if updating
    if (tripId) {
      await supabase
        .from('trip_cities')
        .delete()
        .eq('trip_id', trip.id)
    }

    // Create trip_cities records
    const citiesToInsert = tripDetails.cities.map((city, index) => ({
      trip_id: trip.id,
      name: city.name,
      start_date: city.start_date,
      end_date: city.end_date,
      order_index: index
    }))

    const { data: insertedCities, error: citiesError } = await supabase
      .from('trip_cities')
      .insert(citiesToInsert)
      .select()

    if (citiesError) {
      console.error('Error inserting cities:', citiesError)
      // Don't fail silently - return error to help diagnose issues
      return NextResponse.json(
        { error: `Failed to create trip cities: ${citiesError.message}`, details: citiesError },
        { status: 500 }
      )
    }

    if (!insertedCities || insertedCities.length === 0) {
      console.error('No cities were inserted despite no error')
      return NextResponse.json(
        { error: 'Failed to create trip cities: No cities returned after insert' },
        { status: 500 }
      )
    }

    // Create hotels linked to cities
    if (insertedCities) {
      // Delete existing hotels if updating
      if (tripId) {
        await supabase
          .from('hotels')
          .delete()
          .eq('trip_id', trip.id)
      }

      const hotelsToInsert = tripDetails.cities
        .map((city, index) => {
          if (!city.hotel) return null
          const cityRecord = insertedCities[index]
          return {
            trip_id: trip.id,
            city_id: cityRecord.id,
            name: city.hotel.name,
            address: city.hotel.address,
            check_in_date: city.start_date,
            check_out_date: city.end_date,
            latitude: city.hotel.latitude || null,
            longitude: city.hotel.longitude || null
          }
        })
        .filter(Boolean)

      if (hotelsToInsert.length > 0) {
        await supabase
          .from('hotels')
          .insert(hotelsToInsert)
      }
    }

    // Add travelers if provided
    if (tripDetails.travelers && tripDetails.travelers.length > 0) {
      if (tripId) {
        await supabase
          .from('travelers')
          .delete()
          .eq('trip_id', trip.id)
      }

      const travelersToInsert = tripDetails.travelers.map(t => ({
        trip_id: trip.id,
        name: t.name,
        age: t.age || null
      }))

      await supabase
        .from('travelers')
        .insert(travelersToInsert)
    }

    // Add flights if provided
    if (tripDetails.flights && tripDetails.flights.length > 0) {
      if (tripId) {
        await supabase
          .from('flights')
          .delete()
          .eq('trip_id', trip.id)
      }

      const flightsToInsert = tripDetails.flights.map(f => ({
        trip_id: trip.id,
        airline: f.airline,
        flight_number: f.flight_number,
        departure_time: f.departure_time,
        arrival_time: f.arrival_time,
        departure_airport: f.from_location,
        arrival_airport: f.to_location,
        date: f.date
      }))

      await supabase
        .from('flights')
        .insert(flightsToInsert)
    }

    // Fetch the complete trip with all details
    const [
      { data: cities },
      { data: travelers },
      { data: flights },
      { data: hotels }
    ] = await Promise.all([
      supabase.from('trip_cities').select('*').eq('trip_id', trip.id).order('order_index'),
      supabase.from('travelers').select('*').eq('trip_id', trip.id),
      supabase.from('flights').select('*').eq('trip_id', trip.id),
      supabase.from('hotels').select('*').eq('trip_id', trip.id)
    ])

    return NextResponse.json({
      trip,
      cities: cities || [],
      travelers: travelers || [],
      flights: flights || [],
      hotels: hotels || [],
      parsed: tripDetails
    })
  } catch (error: any) {
    console.error('Error parsing trip:', error)

    // Handle Anthropic API errors specifically
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'AI model not available. Please check your ANTHROPIC_API_KEY or try again later.' },
        { status: 500 }
      )
    }

    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your ANTHROPIC_API_KEY configuration.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to parse trip details' },
      { status: 500 }
    )
  }
}
