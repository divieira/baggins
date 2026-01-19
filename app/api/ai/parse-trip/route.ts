import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

interface TripDetails {
  destination: string
  start_date: string
  end_date: string
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
  }>
  hotels?: Array<{
    name: string
    check_in_date: string
    check_out_date: string
    address: string
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

    // Use Claude to parse the message and extract trip details
    const aiMessage = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: `You are a trip details parser. Extract structured trip information from user messages.

Instructions:
- Extract destination, start_date, end_date, travelers, flights, and hotels if mentioned
- Use ISO date format (YYYY-MM-DD) for dates
- If year is not mentioned, assume current year (2026)
- For travelers, extract names, ages, and relationships if provided
- For flights, extract airline, flight number, times, and locations
- For hotels, extract name, check-in/check-out dates, and address
- If information is partial or missing, include what you can extract
- Return ONLY valid JSON, no additional text

Example output:
{
  "destination": "Paris, France",
  "start_date": "2026-03-15",
  "end_date": "2026-03-20",
  "travelers": [
    {"name": "John", "relation": "self"},
    {"name": "Jane", "relation": "wife"},
    {"name": "Tommy", "age": 8, "relation": "son"},
    {"name": "Sarah", "age": 5, "relation": "daughter"}
  ],
  "flights": [
    {
      "airline": "Air France",
      "flight_number": "AF123",
      "departure_time": "2026-03-15T10:00:00",
      "arrival_time": "2026-03-15T14:30:00",
      "from_location": "New York JFK",
      "to_location": "Paris CDG"
    }
  ],
  "hotels": [
    {
      "name": "Hotel Eiffel",
      "check_in_date": "2026-03-15",
      "check_out_date": "2026-03-20",
      "address": "123 Rue de la Paix, Paris"
    }
  ]
}`,
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
        .eq('user_id', user.id) // Ensure user owns the trip
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

    // Add travelers if provided
    if (tripDetails.travelers && tripDetails.travelers.length > 0) {
      // Delete existing travelers if updating
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
        from_location: f.from_location,
        to_location: f.to_location
      }))

      await supabase
        .from('flights')
        .insert(flightsToInsert)
    }

    // Add hotels if provided
    if (tripDetails.hotels && tripDetails.hotels.length > 0) {
      if (tripId) {
        await supabase
          .from('hotels')
          .delete()
          .eq('trip_id', trip.id)
      }

      const hotelsToInsert = tripDetails.hotels.map(h => ({
        trip_id: trip.id,
        name: h.name,
        check_in_date: h.check_in_date,
        check_out_date: h.check_out_date,
        address: h.address
      }))

      await supabase
        .from('hotels')
        .insert(hotelsToInsert)
    }

    // Fetch the complete trip with all details
    const [
      { data: travelers },
      { data: flights },
      { data: hotels }
    ] = await Promise.all([
      supabase.from('travelers').select('*').eq('trip_id', trip.id),
      supabase.from('flights').select('*').eq('trip_id', trip.id),
      supabase.from('hotels').select('*').eq('trip_id', trip.id)
    ])

    return NextResponse.json({
      trip,
      travelers: travelers || [],
      flights: flights || [],
      hotels: hotels || [],
      parsed: tripDetails
    })
  } catch (error: any) {
    console.error('Error parsing trip:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse trip details' },
      { status: 500 }
    )
  }
}
