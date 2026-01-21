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
    const { tripId, destination, travelers } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build traveler context
    const travelerContext = travelers.length > 0
      ? `Travelers: ${travelers.map((t: any) => `${t.name}${t.age ? ` (${t.age} years old)` : ''}`).join(', ')}`
      : 'Solo traveler'

    // Generate suggestions using Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are a travel planning assistant. Generate detailed attraction and restaurant suggestions for a trip to ${destination}.

${travelerContext}

Please provide:
1. 10 diverse attractions/activities with:
   - Name
   - Brief description (2-3 sentences)
   - Category (museum, park, landmark, shopping, entertainment, etc.)
   - Approximate coordinates (latitude, longitude)
   - Opening/closing times (if applicable, in HH:MM format)
   - Estimated duration in minutes
   - Whether it's kid-friendly (true/false)
   - Minimum age requirement (if any)
   - 2-3 highlights as an array

2. 10 diverse restaurants with:
   - Name
   - Brief description (2-3 sentences)
   - Cuisine type
   - Approximate coordinates (latitude, longitude)
   - Opening/closing times (in HH:MM format)
   - Price level (1-4, where 1 is budget and 4 is expensive)
   - Whether it's kid-friendly (true/false)
   - 2-3 highlights as an array

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "attractions": [
    {
      "name": "string",
      "description": "string",
      "category": "string",
      "latitude": number,
      "longitude": number,
      "opening_time": "HH:MM" or null,
      "closing_time": "HH:MM" or null,
      "duration_minutes": number,
      "is_kid_friendly": boolean,
      "min_age": number or null,
      "highlights": ["string"]
    }
  ],
  "restaurants": [
    {
      "name": "string",
      "description": "string",
      "cuisine_type": "string",
      "latitude": number,
      "longitude": number,
      "opening_time": "HH:MM",
      "closing_time": "HH:MM",
      "price_level": number,
      "is_kid_friendly": boolean,
      "highlights": ["string"]
    }
  ]
}`
      }]
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse the AI response (strip markdown code fences if present)
    const suggestions = JSON.parse(stripMarkdownCodeFences(content.text))

    // Store attractions in database
    const attractionsToInsert = suggestions.attractions.map((a: any) => ({
      trip_id: tripId,
      name: a.name,
      description: a.description,
      category: a.category,
      latitude: a.latitude,
      longitude: a.longitude,
      opening_time: a.opening_time,
      closing_time: a.closing_time,
      duration_minutes: a.duration_minutes,
      is_kid_friendly: a.is_kid_friendly,
      min_age: a.min_age,
      highlights: a.highlights
    }))

    const { error: attractionsError } = await supabase
      .from('attractions')
      .insert(attractionsToInsert)

    if (attractionsError) {
      console.error('Error inserting attractions:', attractionsError)
    }

    // Store restaurants in database
    const restaurantsToInsert = suggestions.restaurants.map((r: any) => ({
      trip_id: tripId,
      name: r.name,
      description: r.description,
      cuisine_type: r.cuisine_type,
      latitude: r.latitude,
      longitude: r.longitude,
      opening_time: r.opening_time,
      closing_time: r.closing_time,
      price_level: r.price_level,
      is_kid_friendly: r.is_kid_friendly,
      highlights: r.highlights
    }))

    const { error: restaurantsError } = await supabase
      .from('restaurants')
      .insert(restaurantsToInsert)

    if (restaurantsError) {
      console.error('Error inserting restaurants:', restaurantsError)
    }

    return NextResponse.json({
      success: true,
      attractions: suggestions.attractions.length,
      restaurants: suggestions.restaurants.length
    })
  } catch (error: any) {
    console.error('Error generating suggestions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
