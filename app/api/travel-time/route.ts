import { NextResponse } from 'next/server'
import { fetchTravelTime, type TravelTimeRequest } from '@/utils/google-maps'

export async function POST(request: Request) {
  try {
    const body: TravelTimeRequest = await request.json()

    const { origin, destination, mode = 'driving' } = body

    // Validate request
    if (!origin || typeof origin.latitude !== 'number' || typeof origin.longitude !== 'number') {
      return NextResponse.json(
        { error: 'Invalid origin coordinates' },
        { status: 400 }
      )
    }

    if (!destination || typeof destination.latitude !== 'number' || typeof destination.longitude !== 'number') {
      return NextResponse.json(
        { error: 'Invalid destination coordinates' },
        { status: 400 }
      )
    }

    // Fetch travel time from Google Maps
    const result = await fetchTravelTime({ origin, destination, mode })

    if (!result) {
      return NextResponse.json(
        { error: 'Unable to fetch travel time. Please check API configuration.' },
        { status: 503 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in travel-time API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
