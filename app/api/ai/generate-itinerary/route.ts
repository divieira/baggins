import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

/**
 * Strips markdown code fences from JSON response if present
 */
function stripMarkdownCodeFences(text: string): string {
  const trimmed = text.trim()
  const jsonFenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (jsonFenceMatch) {
    return jsonFenceMatch[1].trim()
  }
  return trimmed
}

export async function POST(request: Request) {
  try {
    const { tripId, cityId, selectedAttractionIds, selectedRestaurantIds } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get trip and city details
    const [{ data: trip }, { data: city }, { data: hotel }] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('trip_cities').select('*').eq('id', cityId).single(),
      supabase.from('hotels').select('*').eq('city_id', cityId).single()
    ])

    if (!trip || !city) {
      return NextResponse.json({ error: 'Trip or city not found' }, { status: 404 })
    }

    // Get selected attractions and restaurants
    const [{ data: attractions }, { data: restaurants }] = await Promise.all([
      supabase.from('attractions')
        .select('*')
        .in('id', selectedAttractionIds || []),
      supabase.from('restaurants')
        .select('*')
        .in('id', selectedRestaurantIds || [])
    ])

    // Calculate number of days
    const startDate = new Date(city.start_date)
    const endDate = new Date(city.end_date)
    const numDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Build time blocks structure for AI
    const timeBlocksTemplate = []
    for (let day = 0; day < numDays; day++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + day)
      const dateStr = date.toISOString().split('T')[0]

      timeBlocksTemplate.push(
        { date: dateStr, blockType: 'morning', startTime: '09:00', endTime: '12:00' },
        { date: dateStr, blockType: 'lunch', startTime: '12:00', endTime: '13:30' },
        { date: dateStr, blockType: 'afternoon', startTime: '13:30', endTime: '17:00' },
        { date: dateStr, blockType: 'dinner', startTime: '18:00', endTime: '20:00' },
        { date: dateStr, blockType: 'evening', startTime: '20:00', endTime: '23:00' }
      )
    }

    // Get current plan version
    const { data: currentVersion } = await supabase
      .from('plan_versions')
      .select('*')
      .eq('trip_id', tripId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    // Use AI to create optimal itinerary
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are a travel planning assistant. Create an optimal itinerary for ${city.name} based on the selected attractions and restaurants.

City: ${city.name}
Dates: ${city.start_date} to ${city.end_date}
Hotel location: ${hotel ? `${hotel.latitude}, ${hotel.longitude}` : 'Not specified'}

Available time blocks:
${JSON.stringify(timeBlocksTemplate, null, 2)}

Selected Attractions (for morning, afternoon, evening blocks):
${JSON.stringify(attractions?.map(a => ({
  id: a.id,
  name: a.name,
  latitude: a.latitude,
  longitude: a.longitude,
  opening_time: a.opening_time,
  closing_time: a.closing_time,
  duration_minutes: a.duration_minutes,
  category: a.category
})) || [], null, 2)}

Selected Restaurants (for lunch, dinner blocks):
${JSON.stringify(restaurants?.map(r => ({
  id: r.id,
  name: r.name,
  latitude: r.latitude,
  longitude: r.longitude,
  opening_time: r.opening_time,
  closing_time: r.closing_time,
  cuisine_type: r.cuisine_type
})) || [], null, 2)}

Create an optimal schedule considering:
1. Opening hours of each place
2. Geographic proximity (minimize travel time between consecutive places)
3. Appropriate meal times (restaurants for lunch around 12:00-13:30, dinner around 18:00-20:00)
4. Duration of activities
5. Spread activities across days evenly
6. Each attraction/restaurant should only be assigned to ONE time block

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "itinerary": [
    {
      "date": "YYYY-MM-DD",
      "blockType": "morning|lunch|afternoon|dinner|evening",
      "attractionId": "uuid or null",
      "restaurantId": "uuid or null"
    }
  ],
  "summary": "Brief explanation of the itinerary logic"
}

IMPORTANT:
- For morning, afternoon, evening blocks: use attractionId only
- For lunch, dinner blocks: use restaurantId only
- Don't assign the same place to multiple blocks
- Leave blocks null if no suitable place is available`
      }]
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    const itineraryResponse = JSON.parse(stripMarkdownCodeFences(content.text))

    // Create new plan version
    const newVersionNumber = currentVersion ? currentVersion.version_number + 1 : 1
    const { data: newVersion, error: versionError } = await supabase
      .from('plan_versions')
      .insert({
        trip_id: tripId,
        version_number: newVersionNumber,
        plan_data: {
          type: 'ai_generated_itinerary',
          summary: itineraryResponse.summary,
          timestamp: new Date().toISOString()
        },
        created_by: user.id
      })
      .select()
      .single()

    if (versionError) {
      console.error('Error creating plan version:', versionError)
      throw new Error('Failed to create plan version')
    }

    // Create time blocks based on AI response
    const timeBlocksToInsert = itineraryResponse.itinerary.map((block: any) => ({
      trip_id: tripId,
      city_id: cityId,
      plan_version_id: newVersion.id,
      date: block.date,
      block_type: block.blockType,
      start_time: timeBlocksTemplate.find(t => t.date === block.date && t.blockType === block.blockType)?.startTime || '09:00',
      end_time: timeBlocksTemplate.find(t => t.date === block.date && t.blockType === block.blockType)?.endTime || '12:00',
      selected_attraction_id: block.attractionId || null,
      selected_restaurant_id: block.restaurantId || null
    }))

    // Also add any time blocks that AI didn't return (empty blocks)
    timeBlocksTemplate.forEach(template => {
      const exists = timeBlocksToInsert.some(
        (b: any) => b.date === template.date && b.block_type === template.blockType
      )
      if (!exists) {
        timeBlocksToInsert.push({
          trip_id: tripId,
          city_id: cityId,
          plan_version_id: newVersion.id,
          date: template.date,
          block_type: template.blockType,
          start_time: template.startTime,
          end_time: template.endTime,
          selected_attraction_id: null,
          selected_restaurant_id: null
        })
      }
    })

    const { error: blocksError } = await supabase
      .from('time_blocks')
      .insert(timeBlocksToInsert)

    if (blocksError) {
      console.error('Error creating time blocks:', blocksError)
      throw new Error('Failed to create time blocks')
    }

    return NextResponse.json({
      success: true,
      versionId: newVersion.id,
      versionNumber: newVersion.version_number,
      summary: itineraryResponse.summary
    })
  } catch (error: any) {
    console.error('Error generating itinerary:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate itinerary' },
      { status: 500 }
    )
  }
}
