import Anthropic from '@anthropic-ai/sdk'
import { SupabaseClient } from '@supabase/supabase-js'
import { getPlacePhotoUrl } from '@/utils/google-places'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

/**
 * Strips markdown code fences from JSON response if present
 */
function stripMarkdownCodeFences(text: string): string {
  const trimmed = text.trim()
  const jsonFenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
  if (jsonFenceMatch) {
    return jsonFenceMatch[1].trim()
  }
  return trimmed
}

interface Traveler {
  name: string
  age?: number | null
}

interface GenerateSuggestionsParams {
  supabase: SupabaseClient
  tripId: string
  cityId: string
  cityName: string
  travelers?: Traveler[]
}

interface GenerateSuggestionsResult {
  attractions: any[]
  restaurants: any[]
}

/**
 * Generate AI suggestions for attractions and restaurants for a city
 */
export async function generateCitySuggestions({
  supabase,
  tripId,
  cityId,
  cityName,
  travelers = []
}: GenerateSuggestionsParams): Promise<GenerateSuggestionsResult> {
  // Validate required parameters
  if (!cityId) {
    throw new Error(`cityId is required but got: ${cityId}`)
  }
  if (!tripId) {
    throw new Error(`tripId is required but got: ${tripId}`)
  }
  if (!cityName) {
    throw new Error(`cityName is required but got: ${cityName}`)
  }

  console.log(`[generateCitySuggestions] Starting for city "${cityName}" (ID: ${cityId})`)

  // Build traveler context
  const travelerContext = travelers.length > 0
    ? `Travelers: ${travelers.map(t => `${t.name}${t.age ? ` (${t.age} years old)` : ''}`).join(', ')}`
    : 'Solo traveler'

  // Generate suggestions using Claude
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are a travel planning assistant. Generate detailed attraction and restaurant suggestions for ${cityName}.

${travelerContext}

Please provide:
1. 10 diverse attractions/activities with:
   - Name
   - Brief description (2-3 sentences)
   - Category (museum, park, landmark, shopping, entertainment, etc.)
   - Approximate coordinates (latitude, longitude) - IMPORTANT: Must be real coordinates for ${cityName}
   - Opening/closing times (if applicable, in HH:MM format)
   - Estimated duration in minutes
   - Whether it's kid-friendly (true/false)
   - Minimum age requirement (if any)
   - 2-3 highlights as an array
   - image_search_term: A specific search term for finding an image (e.g., "Eiffel Tower Paris", "Louvre Museum interior")

2. 10 diverse restaurants with:
   - Name
   - Brief description (2-3 sentences)
   - Cuisine type
   - Approximate coordinates (latitude, longitude) - IMPORTANT: Must be real coordinates for ${cityName}
   - Opening/closing times (in HH:MM format)
   - Price level (1-4, where 1 is budget and 4 is expensive)
   - Whether it's kid-friendly (true/false)
   - 2-3 highlights as an array
   - image_search_term: A specific search term for finding an image (e.g., "French fine dining", "Italian trattoria Rome")

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
      "highlights": ["string"],
      "image_search_term": "string"
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
      "highlights": ["string"],
      "image_search_term": "string"
    }
  ]
}`
    }]
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  // Parse the AI response
  const suggestions = JSON.parse(stripMarkdownCodeFences(content.text))

  // Helper to get image URL with fallback chain:
  // 1. Try Google Places API (if configured and place found)
  // 2. Fall back to Unsplash with search term
  const getImageUrl = async (
    name: string,
    searchTerm: string,
    latitude: number,
    longitude: number
  ): Promise<string> => {
    // Try Google Places API first
    const placesUrl = await getPlacePhotoUrl(name, latitude, longitude)
    if (placesUrl) {
      return placesUrl
    }

    // Fallback to Unsplash
    const query = encodeURIComponent(searchTerm)
    return `https://source.unsplash.com/800x600/?${query}`
  }

  // Store attractions in database with city_id
  // Use Promise.all for parallel photo fetching
  const attractionsToInsert = await Promise.all(
    suggestions.attractions.map(async (a: any) => ({
      trip_id: tripId,
      city_id: cityId,
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
      highlights: a.highlights,
      image_url: await getImageUrl(
        a.name,
        a.image_search_term || `${a.name} ${cityName}`,
        a.latitude,
        a.longitude
      )
    }))
  )

  // Validate all attractions have city_id before inserting
  const invalidAttractions = attractionsToInsert.filter(a => !a.city_id)
  if (invalidAttractions.length > 0) {
    console.error(`[generateCitySuggestions] ERROR: ${invalidAttractions.length} attractions missing city_id!`)
    console.error('Invalid attractions:', invalidAttractions.map(a => ({ name: a.name, city_id: a.city_id })))
    throw new Error(`Cannot insert attractions without city_id`)
  }

  const { data: insertedAttractions, error: attractionsError } = await supabase
    .from('attractions')
    .insert(attractionsToInsert)
    .select()

  if (attractionsError) {
    console.error('[generateCitySuggestions] Error inserting attractions:', attractionsError)
    throw attractionsError
  }

  // Verify inserted attractions have correct city_id
  if (insertedAttractions && insertedAttractions.length > 0) {
    const wrongCityId = insertedAttractions.filter(a => a.city_id !== cityId)
    if (wrongCityId.length > 0) {
      console.error(`[generateCitySuggestions] WARNING: ${wrongCityId.length} attractions have wrong city_id!`)
      console.error(`Expected: ${cityId}, Got:`, wrongCityId.map(a => ({ name: a.name, city_id: a.city_id })))
    }
    console.log(`[generateCitySuggestions] ✓ Inserted ${insertedAttractions.length} attractions for ${cityName}`)
  }

  // Store restaurants in database with city_id
  // Use Promise.all for parallel photo fetching
  const restaurantsToInsert = await Promise.all(
    suggestions.restaurants.map(async (r: any) => ({
      trip_id: tripId,
      city_id: cityId,
      name: r.name,
      description: r.description,
      cuisine_type: r.cuisine_type,
      latitude: r.latitude,
      longitude: r.longitude,
      opening_time: r.opening_time,
      closing_time: r.closing_time,
      price_level: r.price_level,
      is_kid_friendly: r.is_kid_friendly,
      highlights: r.highlights,
      image_url: await getImageUrl(
        r.name,
        r.image_search_term || `${r.cuisine_type} restaurant food`,
        r.latitude,
        r.longitude
      )
    }))
  )

  // Validate all restaurants have city_id before inserting
  const invalidRestaurants = restaurantsToInsert.filter(r => !r.city_id)
  if (invalidRestaurants.length > 0) {
    console.error(`[generateCitySuggestions] ERROR: ${invalidRestaurants.length} restaurants missing city_id!`)
    console.error('Invalid restaurants:', invalidRestaurants.map(r => ({ name: r.name, city_id: r.city_id })))
    throw new Error(`Cannot insert restaurants without city_id`)
  }

  const { data: insertedRestaurants, error: restaurantsError } = await supabase
    .from('restaurants')
    .insert(restaurantsToInsert)
    .select()

  if (restaurantsError) {
    console.error('[generateCitySuggestions] Error inserting restaurants:', restaurantsError)
    throw restaurantsError
  }

  // Verify inserted restaurants have correct city_id
  if (insertedRestaurants && insertedRestaurants.length > 0) {
    const wrongCityId = insertedRestaurants.filter(r => r.city_id !== cityId)
    if (wrongCityId.length > 0) {
      console.error(`[generateCitySuggestions] WARNING: ${wrongCityId.length} restaurants have wrong city_id!`)
      console.error(`Expected: ${cityId}, Got:`, wrongCityId.map(r => ({ name: r.name, city_id: r.city_id })))
    }
    console.log(`[generateCitySuggestions] ✓ Inserted ${insertedRestaurants.length} restaurants for ${cityName}`)
  }

  return {
    attractions: insertedAttractions || [],
    restaurants: insertedRestaurants || []
  }
}
