import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

interface ModifiedBlock {
  id: string
  selectedAttractionId: string | null
  selectedRestaurantId: string | null
}

interface Traveler {
  name: string
  age?: number
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

/**
 * Strips markdown code fences from JSON response if present
 */
function stripMarkdownCodeFences(text: string): string {
  const trimmed = text.trim()

  // Check for ```json ... ``` or ``` ... ```
  const jsonFenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (jsonFenceMatch) {
    return jsonFenceMatch[1].trim()
  }

  return trimmed
}

export async function POST(request: Request) {
  try {
    const { tripId, modificationRequest } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get trip details
    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    // Get cities for multi-city support
    const { data: cities } = await supabase
      .from('trip_cities')
      .select('*')
      .eq('trip_id', tripId)
      .order('order_index')

    // Get current plan version
    const { data: currentVersion } = await supabase
      .from('plan_versions')
      .select('*')
      .eq('trip_id', tripId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    if (!currentVersion) {
      return NextResponse.json({ error: 'No plan version found' }, { status: 404 })
    }

    // Get current time blocks
    const { data: currentTimeBlocks } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('plan_version_id', currentVersion.id)
      .order('date')
      .order('start_time')

    // Get all city IDs
    const cityIds = cities?.map(c => c.id) || []

    // Get available attractions and restaurants for all cities
    const [{ data: attractions }, { data: restaurants }] = await Promise.all([
      cityIds.length > 0
        ? supabase.from('attractions').select('*').in('city_id', cityIds)
        : supabase.from('attractions').select('*').eq('trip_id', tripId),
      cityIds.length > 0
        ? supabase.from('restaurants').select('*').in('city_id', cityIds)
        : supabase.from('restaurants').select('*').eq('trip_id', tripId)
    ])

    // Build city lookup for date ranges
    const getCityForDate = (dateStr: string) => {
      return cities?.find(c => dateStr >= c.start_date && dateStr <= c.end_date) || null
    }

    // Build current plan state with city information
    const currentPlan = {
      cities: cities?.map(c => ({
        id: c.id,
        name: c.name,
        start_date: c.start_date,
        end_date: c.end_date
      })) || [],
      timeBlocks: currentTimeBlocks?.map(block => {
        const blockCity = getCityForDate(block.date)
        return {
          id: block.id,
          date: block.date,
          cityId: block.city_id || blockCity?.id,
          cityName: blockCity?.name,
          blockType: block.block_type,
          startTime: block.start_time,
          endTime: block.end_time,
          selectedAttractionId: block.selected_attraction_id,
          selectedRestaurantId: block.selected_restaurant_id
        }
      }) || [],
      availableAttractions: attractions?.map(a => {
        const attrCity = cities?.find(c => c.id === a.city_id)
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          category: a.category,
          duration_minutes: a.duration_minutes,
          is_kid_friendly: a.is_kid_friendly,
          min_age: a.min_age,
          cityId: a.city_id,
          cityName: attrCity?.name
        }
      }) || [],
      availableRestaurants: restaurants?.map(r => {
        const restCity = cities?.find(c => c.id === r.city_id)
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          cuisine_type: r.cuisine_type,
          price_level: r.price_level,
          is_kid_friendly: r.is_kid_friendly,
          cityId: r.city_id,
          cityName: restCity?.name
        }
      }) || []
    }

    // Get travelers for context
    const { data: travelers } = await supabase
      .from('travelers')
      .select('*')
      .eq('trip_id', tripId)

    const travelerContext = travelers && travelers.length > 0
      ? `Travelers: ${travelers.map((t: Traveler) => `${t.name}${t.age ? ` (${t.age} years old)` : ''}`).join(', ')}`
      : 'Solo traveler'

    // Build city information for the prompt
    const cityInfo = cities && cities.length > 0
      ? `\nCities in this trip:\n${cities.map(c => `- ${c.name}: ${c.start_date} to ${c.end_date}`).join('\n')}`
      : ''

    // Send to Claude for modification
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are a travel planning assistant. The user has requested a modification to their trip plan.

Trip: ${trip.destination}
Dates: ${trip.start_date} to ${trip.end_date}
${travelerContext}
${cityInfo}

Current Plan:
${JSON.stringify(currentPlan, null, 2)}

User Request: "${modificationRequest}"

Please update the plan based on the user's request. You can:
1. Add attractions/restaurants to empty time blocks
2. Replace existing selections with better alternatives
3. Reorganize the schedule

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "timeBlocks": [
    {
      "id": "uuid",
      "selectedAttractionId": "uuid" or null,
      "selectedRestaurantId": "uuid" or null
    }
  ],
  "summary": "Brief description of changes made (1-2 sentences)"
}

CRITICAL REQUIREMENTS:
- Only include timeBlocks that have changes (new selections or removals)
- Use attraction IDs from availableAttractions and restaurant IDs from availableRestaurants
- For lunch/dinner blocks, use selectedRestaurantId (attractionId must be null)
- For morning/afternoon/evening blocks, use selectedAttractionId (restaurantId must be null)
- IMPORTANT: Only assign attractions/restaurants to time blocks in THEIR OWN CITY
  * Check the cityId of each attraction/restaurant
  * Check the cityId of each time block
  * They MUST match - do NOT assign Paris attractions to Rome days!
- Set to null to remove a selection
- Do not invent new IDs - only use IDs from the available lists`
      }]
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse the AI response
    console.log('AI raw response:', content.text)
    const modifiedPlan = JSON.parse(stripMarkdownCodeFences(content.text))
    console.log('Parsed modifications:', JSON.stringify(modifiedPlan, null, 2))

    // Validate the response structure
    if (!modifiedPlan.timeBlocks || !Array.isArray(modifiedPlan.timeBlocks)) {
      console.error('AI returned invalid response: missing or invalid timeBlocks array')
      return NextResponse.json(
        { error: 'AI returned an invalid response format' },
        { status: 500 }
      )
    }

    // Log summary
    console.log(`AI returned ${modifiedPlan.timeBlocks.length} modified blocks`)

    // Validate that all returned block IDs exist in the current time blocks
    const existingBlockIds = new Set(currentTimeBlocks?.map(b => b.id) || [])
    const invalidIds = modifiedPlan.timeBlocks.filter((b: ModifiedBlock) => !existingBlockIds.has(b.id))
    if (invalidIds.length > 0) {
      console.warn('AI returned modifications for non-existent block IDs:', invalidIds.map((b: ModifiedBlock) => b.id))
    }

    // Validate that attraction/restaurant IDs are valid
    const attractionIds = new Set(attractions?.map(a => a.id) || [])
    const restaurantIds = new Set(restaurants?.map(r => r.id) || [])

    for (const block of modifiedPlan.timeBlocks as ModifiedBlock[]) {
      if (block.selectedAttractionId && !attractionIds.has(block.selectedAttractionId)) {
        console.error(`Invalid attraction ID: ${block.selectedAttractionId}`)
        return NextResponse.json(
          { error: `AI selected an invalid attraction ID: ${block.selectedAttractionId}` },
          { status: 500 }
        )
      }
      if (block.selectedRestaurantId && !restaurantIds.has(block.selectedRestaurantId)) {
        console.error(`Invalid restaurant ID: ${block.selectedRestaurantId}`)
        return NextResponse.json(
          { error: `AI selected an invalid restaurant ID: ${block.selectedRestaurantId}` },
          { status: 500 }
        )
      }
    }

    // Create new plan version
    const { data: newVersion, error: versionError } = await supabase
      .from('plan_versions')
      .insert({
        trip_id: tripId,
        version_number: currentVersion.version_number + 1,
        plan_data: {
          modification: modificationRequest,
          summary: modifiedPlan.summary,
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

    // Create map of modifications by block ID
    const modificationsMap = new Map<string, { selectedAttractionId: string | null; selectedRestaurantId: string | null }>()
    modifiedPlan.timeBlocks.forEach((modifiedBlock: ModifiedBlock) => {
      // Only add to map if the block ID exists in current time blocks
      if (existingBlockIds.has(modifiedBlock.id)) {
        modificationsMap.set(modifiedBlock.id, {
          selectedAttractionId: modifiedBlock.selectedAttractionId,
          selectedRestaurantId: modifiedBlock.selectedRestaurantId
        })
      }
    })

    console.log(`Applied ${modificationsMap.size} valid modifications out of ${modifiedPlan.timeBlocks.length} returned by AI`)

    // Validate that modifications don't assign attractions to wrong cities
    for (const [blockId, modification] of modificationsMap.entries()) {
      const block = currentTimeBlocks?.find(b => b.id === blockId)
      if (!block) continue

      const blockCity = getCityForDate(block.date)

      if (modification.selectedAttractionId) {
        const attraction = attractions?.find(a => a.id === modification.selectedAttractionId)
        if (attraction && blockCity && attraction.city_id !== blockCity.id) {
          console.error(`Validation failed: Attraction ${attraction.id} from city ${attraction.city_id} assigned to block in city ${blockCity.id}`)
          return NextResponse.json(
            { error: `Validation failed: Cannot assign attraction from one city to a time block in another city` },
            { status: 500 }
          )
        }
      }

      if (modification.selectedRestaurantId) {
        const restaurant = restaurants?.find(r => r.id === modification.selectedRestaurantId)
        if (restaurant && blockCity && restaurant.city_id !== blockCity.id) {
          console.error(`Validation failed: Restaurant ${restaurant.id} from city ${restaurant.city_id} assigned to block in city ${blockCity.id}`)
          return NextResponse.json(
            { error: `Validation failed: Cannot assign restaurant from one city to a time block in another city` },
            { status: 500 }
          )
        }
      }
    }

    // Copy all current time blocks to new version with modifications applied
    const newTimeBlocks = currentTimeBlocks?.map(block => {
      const modification = modificationsMap.get(block.id)
      const blockCity = getCityForDate(block.date)
      return {
        trip_id: block.trip_id,
        city_id: block.city_id || blockCity?.id,
        plan_version_id: newVersion.id,
        date: block.date,
        block_type: block.block_type,
        start_time: block.start_time,
        end_time: block.end_time,
        selected_attraction_id: modification?.selectedAttractionId !== undefined
          ? modification.selectedAttractionId
          : block.selected_attraction_id,
        selected_restaurant_id: modification?.selectedRestaurantId !== undefined
          ? modification.selectedRestaurantId
          : block.selected_restaurant_id
      }
    }) || []

    console.log(`Creating ${newTimeBlocks.length} time blocks for new version ${newVersion.id}`)
    console.log('Modifications applied:', Array.from(modificationsMap.entries()))

    // Insert new time blocks
    const { error: blocksError } = await supabase
      .from('time_blocks')
      .insert(newTimeBlocks)

    if (blocksError) {
      console.error('Error creating time blocks:', blocksError)
      throw new Error('Failed to create time blocks')
    }

    console.log('Successfully created time blocks for version', newVersion.version_number)

    return NextResponse.json({
      success: true,
      versionId: newVersion.id,
      versionNumber: newVersion.version_number,
      summary: modifiedPlan.summary
    })
  } catch (error) {
    console.error('Error modifying plan:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to modify plan'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
