/**
 * Google Places API utilities for place search and photo fetching
 */

export interface PlaceSearchResult {
  place_id: string
  name: string
  formatted_address: string
  photos?: Array<{
    photo_reference: string
    height: number
    width: number
  }>
}

export interface PlacesTextSearchResponse {
  results: PlaceSearchResult[]
  status: string
}

/**
 * Search for a place by name and coordinates using Google Places Text Search API
 * Returns the first matching place with its place_id and photo references
 */
export async function searchPlace(
  name: string,
  latitude: number,
  longitude: number
): Promise<PlaceSearchResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not configured, cannot search for place photos')
    return null
  }

  // Build search query with name and location bias
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  url.searchParams.set('query', name)
  url.searchParams.set('location', `${latitude},${longitude}`)
  url.searchParams.set('radius', '500') // Search within 500m radius
  url.searchParams.set('key', apiKey)

  try {
    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`Places API error: ${response.status} ${response.statusText}`)
    }

    const data: PlacesTextSearchResponse = await response.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places API status: ${data.status}`)
    }

    // Return first result if found
    if (data.results.length > 0) {
      return data.results[0]
    }

    console.warn(`No place found for: ${name} at ${latitude},${longitude}`)
    return null
  } catch (error) {
    console.error('Error searching for place:', error)
    return null
  }
}

/**
 * Get photo URL for a place using Google Places Photo API
 * Returns a URL that can be used directly in img src attributes
 */
export async function getPlacePhoto(placeId: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not configured, cannot fetch place photos')
    return null
  }

  try {
    // First, get place details to retrieve photo reference
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    detailsUrl.searchParams.set('place_id', placeId)
    detailsUrl.searchParams.set('fields', 'photos')
    detailsUrl.searchParams.set('key', apiKey)

    const response = await fetch(detailsUrl.toString())

    if (!response.ok) {
      throw new Error(`Place Details API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      throw new Error(`Place Details API status: ${data.status}`)
    }

    const photos = data.result?.photos
    if (!photos || photos.length === 0) {
      console.warn(`No photos found for place_id: ${placeId}`)
      return null
    }

    // Get first photo reference
    const photoReference = photos[0].photo_reference

    // Build photo URL
    const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo')
    photoUrl.searchParams.set('maxwidth', '800')
    photoUrl.searchParams.set('photo_reference', photoReference)
    photoUrl.searchParams.set('key', apiKey)

    return photoUrl.toString()
  } catch (error) {
    console.error('Error fetching place photo:', error)
    return null
  }
}

/**
 * Convenience function: Search for a place and get its photo URL in one call
 * This combines searchPlace and getPlacePhoto for the common use case
 */
export async function getPlacePhotoUrl(
  name: string,
  latitude: number,
  longitude: number
): Promise<string | null> {
  // Search for the place
  const place = await searchPlace(name, latitude, longitude)
  if (!place) {
    return null
  }

  // Check if place has photos in search results
  if (place.photos && place.photos.length > 0) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (apiKey) {
      const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo')
      photoUrl.searchParams.set('maxwidth', '800')
      photoUrl.searchParams.set('photo_reference', place.photos[0].photo_reference)
      photoUrl.searchParams.set('key', apiKey)
      return photoUrl.toString()
    }
  }

  // If no photos in search results, try getting from place details
  return getPlacePhoto(place.place_id)
}
