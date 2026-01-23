/**
 * Google Maps utilities for link generation and travel time calculations
 */

export interface Location {
  latitude: number
  longitude: number
}

export interface TravelTimeResult {
  distanceMeters: number
  distanceText: string
  durationSeconds: number
  durationText: string
  mode: 'driving' | 'walking' | 'transit' | 'bicycling'
}

export interface TravelTimeRequest {
  origin: Location
  destination: Location
  mode?: 'driving' | 'walking' | 'transit' | 'bicycling'
}

export interface DistanceMatrixResponse {
  rows: Array<{
    elements: Array<{
      status: string
      distance?: {
        value: number
        text: string
      }
      duration?: {
        value: number
        text: string
      }
      duration_in_traffic?: {
        value: number
        text: string
      }
    }>
  }>
  status: string
}

/**
 * Generate a Google Maps search link for a location
 */
export function generateMapsSearchLink(location: Location, placeName?: string): string {
  if (placeName) {
    const encoded = encodeURIComponent(placeName)
    return `https://www.google.com/maps/search/?api=1&query=${encoded}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
}

/**
 * Generate a Google Maps directions link from origin to destination
 */
export function generateMapsDirectionsLink(
  origin: Location,
  destination: Location,
  mode: 'driving' | 'walking' | 'transit' | 'bicycling' = 'driving'
): string {
  const originCoords = `${origin.latitude},${origin.longitude}`
  const destCoords = `${destination.latitude},${destination.longitude}`
  return `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}&travelmode=${mode}`
}

/**
 * Fetch travel time using Google Maps Distance Matrix API
 * Note: Requires GOOGLE_MAPS_API_KEY environment variable
 */
export async function fetchTravelTime(
  request: TravelTimeRequest
): Promise<TravelTimeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not configured, falling back to estimation')
    return null
  }

  const { origin, destination, mode = 'driving' } = request

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', `${origin.latitude},${origin.longitude}`)
  url.searchParams.set('destinations', `${destination.latitude},${destination.longitude}`)
  url.searchParams.set('mode', mode)
  url.searchParams.set('key', apiKey)

  // Add departure time for more accurate traffic estimates (only for driving/transit)
  if (mode === 'driving' || mode === 'transit') {
    url.searchParams.set('departure_time', 'now')
  }

  try {
    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`Distance Matrix API error: ${response.status} ${response.statusText}`)
    }

    const data: DistanceMatrixResponse = await response.json()

    if (data.status !== 'OK') {
      throw new Error(`Distance Matrix API status: ${data.status}`)
    }

    const element = data.rows[0]?.elements[0]

    if (!element || element.status !== 'OK') {
      throw new Error(`No route found: ${element?.status || 'UNKNOWN'}`)
    }

    if (!element.distance || !element.duration) {
      throw new Error('Missing distance or duration in response')
    }

    // Use duration_in_traffic if available (only for driving mode)
    const duration = element.duration_in_traffic || element.duration

    return {
      distanceMeters: element.distance.value,
      distanceText: element.distance.text,
      durationSeconds: duration.value,
      durationText: duration.text,
      mode
    }
  } catch (error) {
    console.error('Error fetching travel time from Google Maps:', error)
    return null
  }
}

/**
 * Convert seconds to minutes (rounded up)
 */
export function secondsToMinutes(seconds: number): number {
  return Math.ceil(seconds / 60)
}

/**
 * Format travel time for display
 */
export function formatTravelTimeText(durationText: string, mode: string): string {
  const modeLabel = mode === 'driving' ? '🚗' : mode === 'walking' ? '🚶' : mode === 'transit' ? '🚌' : '🚴'
  return `${modeLabel} ${durationText}`
}
