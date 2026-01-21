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

    // Get available attractions and restaurants
    const [{ data: attractions }, { data: restaurants }] = await Promise.all([
      supabase.from('attractions').select('*').eq('trip_id', tripId),
      supabase.from('restaurants').select('*').eq('trip_id', tripId)
    ])

    // Build current plan state
    const currentPlan = {
      timeBlocks: currentTimeBlocks?.map(block => ({
        id: block.id,
        date: block.date,
        blockType: block.block_type,
        startTime: block.start_time,
        endTime: block.end_time,
        selectedAttractionId: block.selected_attraction_id,
        selectedRestaurantId: block.selected_restaurant_id
      })) || [],
      availableAttractions: attractions?.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        duration_minutes: a.duration_minutes,
        is_kid_friendly: a.is_kid_friendly,
        min_age: a.min_age
      })) || [],
      availableRestaurants: restaurants?.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        cuisine_type: r.cuisine_type,
        price_level: r.price_level,
        is_kid_friendly: r.is_kid_friendly
      })) || []
    }

    // Get travelers for context
    const { data: travelers } = await supabase
      .from('travelers')
      .select('*')
      .eq('trip_id', tripId)

    const travelerContext = travelers && travelers.length > 0
      ? `Travelers: ${travelers.map((t: any) => `${t.name}${t.age ? ` (${t.age} years old)` : ''}`).join(', ')}`
      : 'Solo traveler'

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

IMPORTANT:
- Only include timeBlocks that have changes (new selections or removals)
- Use attraction IDs from availableAttractions and restaurant IDs from availableRestaurants
- For lunch/dinner blocks, use selectedRestaurantId
- For morning/afternoon/evening blocks, use selectedAttractionId
- Set to null to remove a selection
- Do not invent new IDs`
      }]
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse the AI response
    const modifiedPlan = JSON.parse(stripMarkdownCodeFences(content.text))

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
    const modificationsMap = new Map()
    modifiedPlan.timeBlocks.forEach((modifiedBlock: any) => {
      modificationsMap.set(modifiedBlock.id, {
        selectedAttractionId: modifiedBlock.selectedAttractionId,
        selectedRestaurantId: modifiedBlock.selectedRestaurantId
      })
    })

    // Copy all current time blocks to new version with modifications applied
    const newTimeBlocks = currentTimeBlocks?.map(block => {
      const modification = modificationsMap.get(block.id)
      return {
        trip_id: block.trip_id,
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

    // Insert new time blocks
    const { error: blocksError } = await supabase
      .from('time_blocks')
      .insert(newTimeBlocks)

    if (blocksError) {
      console.error('Error creating time blocks:', blocksError)
      throw new Error('Failed to create time blocks')
    }

    return NextResponse.json({
      success: true,
      versionId: newVersion.id,
      versionNumber: newVersion.version_number,
      summary: modifiedPlan.summary
    })
  } catch (error: any) {
    console.error('Error modifying plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to modify plan' },
      { status: 500 }
    )
  }
}
