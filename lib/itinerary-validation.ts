/**
 * Itinerary validation utilities
 */

export interface ItineraryBlock {
  date: string
  blockType: string
  attractionId: string | null
  restaurantId: string | null
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates that the AI-generated itinerary meets basic sanity checks
 */
export function validateItinerary(
  itinerary: ItineraryBlock[],
  cityStartDate: string,
  cityEndDate: string,
  selectedAttractionIds: string[]
): ValidationResult {
  const startDate = new Date(cityStartDate)
  const endDate = new Date(cityEndDate)

  // Check 1: All dates must be within city date range
  for (const block of itinerary) {
    const blockDate = new Date(block.date)
    if (blockDate < startDate || blockDate > endDate) {
      return {
        valid: false,
        error: `Itinerary validation failed: Block dated ${block.date} is outside city date range (${cityStartDate} to ${cityEndDate})`
      }
    }
  }

  // Check 2: No duplicate attractions
  const usedAttractionIds = new Set<string>()
  for (const block of itinerary) {
    if (block.attractionId) {
      if (usedAttractionIds.has(block.attractionId)) {
        return {
          valid: false,
          error: `Itinerary validation failed: Attraction ${block.attractionId} is assigned to multiple time blocks`
        }
      }
      usedAttractionIds.add(block.attractionId)
    }
  }

  // Check 3: No duplicate restaurants
  const usedRestaurantIds = new Set<string>()
  for (const block of itinerary) {
    if (block.restaurantId) {
      if (usedRestaurantIds.has(block.restaurantId)) {
        return {
          valid: false,
          error: `Itinerary validation failed: Restaurant ${block.restaurantId} is assigned to multiple time blocks`
        }
      }
      usedRestaurantIds.add(block.restaurantId)
    }
  }

  // Check 4: Reasonable distribution - each day should have at least one activity
  // Get all dates in the range
  const numDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const datesWithActivities = new Set<string>()

  for (const block of itinerary) {
    if (block.attractionId || block.restaurantId) {
      datesWithActivities.add(block.date)
    }
  }

  // Allow empty days only if we have very few attractions
  if (selectedAttractionIds.length >= 3 && datesWithActivities.size < Math.ceil(numDays / 2)) {
    return {
      valid: false,
      error: `Itinerary validation failed: Poor activity distribution - only ${datesWithActivities.size} of ${numDays} days have activities`
    }
  }

  // Check 5: First day should have activities (unless it's a travel day)
  const firstDayStr = startDate.toISOString().split('T')[0]
  const firstDayBlocks = itinerary.filter(b => b.date === firstDayStr)
  const firstDayHasActivity = firstDayBlocks.some(b => b.attractionId || b.restaurantId)

  if (selectedAttractionIds.length > 0 && !firstDayHasActivity && numDays > 1) {
    return {
      valid: false,
      error: `Itinerary validation failed: First day (${firstDayStr}) has no activities, but attractions are available`
    }
  }

  return { valid: true }
}
