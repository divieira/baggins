import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateCitySuggestions } from '@/lib/ai/generate-suggestions'

export async function POST(request: Request) {
  try {
    const { tripId, cityId, cityName, travelers } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify trip access
    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    const { attractions, restaurants } = await generateCitySuggestions({
      supabase,
      tripId,
      cityId,
      cityName,
      travelers
    })

    return NextResponse.json({
      success: true,
      attractions,
      restaurants
    })
  } catch (error: any) {
    console.error('Error generating city suggestions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
