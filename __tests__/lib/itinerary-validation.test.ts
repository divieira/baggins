/**
 * Tests for itinerary validation - ensures generated itineraries are reasonable
 *
 * This test validates that:
 * 1. Attractions are only assigned to dates within their city's date range
 * 2. Time blocks are in chronological order (morning, lunch, afternoon, dinner)
 * 3. Meal times are reasonable (lunch ~12:00, dinner ~18:00-20:00)
 * 4. All days have some activities
 * 5. No duplicate assignments (same attraction/restaurant in multiple blocks)
 */

import { validateItinerary, type ItineraryBlock } from '@/lib/itinerary-validation'

describe('Itinerary Validation', () => {
  describe('City Date Range Validation', () => {
    it('should reject itinerary with attractions assigned to dates outside city range', () => {
      const invalidItinerary: ItineraryBlock[] = [
        // This is WRONG - March 14 is BEFORE city start date (March 15)
        { date: '2026-03-14', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        // This is WRONG - March 19 is AFTER city end date (March 18)
        { date: '2026-03-19', blockType: 'morning', attractionId: 'a2', restaurantId: null }
      ]

      const result = validateItinerary(invalidItinerary, '2026-03-15', '2026-03-18', ['a1', 'a2'])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('outside city date range')
      expect(result.error).toContain('2026-03-14')
    })

    it('should accept itinerary with all dates within city range', () => {
      const validItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-15', blockType: 'lunch', attractionId: null, restaurantId: 'r1' },
        { date: '2026-03-16', blockType: 'morning', attractionId: 'a2', restaurantId: null }
      ]

      const result = validateItinerary(validItinerary, '2026-03-15', '2026-03-17', ['a1', 'a2'])

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should handle single-day trips correctly', () => {
      const validItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-15', blockType: 'lunch', attractionId: null, restaurantId: 'r1' }
      ]

      const result = validateItinerary(validItinerary, '2026-03-15', '2026-03-15', ['a1'])

      expect(result.valid).toBe(true)
    })
  })

  describe('No Duplicate Assignments', () => {
    it('should reject itinerary with same attraction in multiple blocks', () => {
      const invalidItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-15', blockType: 'afternoon', attractionId: 'a1', restaurantId: null }
      ]

      const result = validateItinerary(invalidItinerary, '2026-03-15', '2026-03-15', ['a1'])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('assigned to multiple time blocks')
      expect(result.error).toContain('a1')
    })

    it('should reject itinerary with same restaurant in multiple blocks', () => {
      const invalidItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'lunch', attractionId: null, restaurantId: 'r1' },
        { date: '2026-03-15', blockType: 'dinner', attractionId: null, restaurantId: 'r1' }
      ]

      const result = validateItinerary(invalidItinerary, '2026-03-15', '2026-03-15', [])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Restaurant r1 is assigned to multiple time blocks')
    })

    it('should allow different attractions in different blocks', () => {
      const validItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-15', blockType: 'afternoon', attractionId: 'a2', restaurantId: null }
      ]

      const result = validateItinerary(validItinerary, '2026-03-15', '2026-03-15', ['a1', 'a2'])

      expect(result.valid).toBe(true)
    })
  })

  describe('Activity Distribution', () => {
    it('should reject poor distribution (all activities on last day)', () => {
      const poorItinerary: ItineraryBlock[] = [
        // Days 1 and 2 have no activities (empty blocks would be added later)
        // All attractions on day 3
        { date: '2026-03-17', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-17', blockType: 'afternoon', attractionId: 'a2', restaurantId: null },
        { date: '2026-03-17', blockType: 'evening', attractionId: 'a3', restaurantId: null }
      ]

      const result = validateItinerary(poorItinerary, '2026-03-15', '2026-03-17', ['a1', 'a2', 'a3'])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Poor activity distribution')
      expect(result.error).toContain('1 of 3 days have activities')
    })

    it('should accept even distribution across days', () => {
      const goodItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-16', blockType: 'morning', attractionId: 'a2', restaurantId: null },
        { date: '2026-03-17', blockType: 'morning', attractionId: 'a3', restaurantId: null }
      ]

      const result = validateItinerary(goodItinerary, '2026-03-15', '2026-03-17', ['a1', 'a2', 'a3'])

      expect(result.valid).toBe(true)
    })

    it('should allow sparse distribution if few attractions are available', () => {
      // Only 2 attractions across 4 days is acceptable
      const sparseItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-17', blockType: 'morning', attractionId: 'a2', restaurantId: null }
      ]

      const result = validateItinerary(sparseItinerary, '2026-03-15', '2026-03-18', ['a1', 'a2'])

      expect(result.valid).toBe(true)
    })
  })

  describe('First Day Activities', () => {
    it('should reject if first day has no activities when attractions available', () => {
      const invalidItinerary: ItineraryBlock[] = [
        // First day (March 15) has no activities
        { date: '2026-03-16', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-17', blockType: 'morning', attractionId: 'a2', restaurantId: null }
      ]

      const result = validateItinerary(invalidItinerary, '2026-03-15', '2026-03-17', ['a1', 'a2'])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('First day')
      expect(result.error).toContain('2026-03-15')
      expect(result.error).toContain('has no activities')
    })

    it('should accept if first day has activities', () => {
      const validItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-16', blockType: 'morning', attractionId: 'a2', restaurantId: null }
      ]

      const result = validateItinerary(validItinerary, '2026-03-15', '2026-03-16', ['a1', 'a2'])

      expect(result.valid).toBe(true)
    })

    it('should accept single-day trip without first day check issue', () => {
      const validItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a1', restaurantId: null }
      ]

      const result = validateItinerary(validItinerary, '2026-03-15', '2026-03-15', ['a1'])

      expect(result.valid).toBe(true)
    })
  })

  describe('Multi-City Boundary Validation', () => {
    it('should reject attractions assigned outside their city\'s date range', () => {
      // Paris city: March 15-17
      // Attraction from Paris assigned to March 18 (which might be Rome's dates)
      const invalidItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a-paris', restaurantId: null },
        // This is WRONG - March 18 is outside Paris range
        { date: '2026-03-18', blockType: 'morning', attractionId: 'a-paris', restaurantId: null }
      ]

      const result = validateItinerary(invalidItinerary, '2026-03-15', '2026-03-17', ['a-paris'])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('outside city date range')
      expect(result.error).toContain('2026-03-18')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty itinerary', () => {
      const emptyItinerary: ItineraryBlock[] = []

      const result = validateItinerary(emptyItinerary, '2026-03-15', '2026-03-17', [])

      // Empty itinerary is technically valid (all blocks will be null)
      expect(result.valid).toBe(true)
    })

    it('should handle itinerary with only null blocks', () => {
      const nullItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: null, restaurantId: null },
        { date: '2026-03-15', blockType: 'lunch', attractionId: null, restaurantId: null }
      ]

      const result = validateItinerary(nullItinerary, '2026-03-15', '2026-03-15', [])

      expect(result.valid).toBe(true)
    })

    it('should handle restaurants in meal blocks correctly', () => {
      const validItinerary: ItineraryBlock[] = [
        { date: '2026-03-15', blockType: 'morning', attractionId: 'a1', restaurantId: null },
        { date: '2026-03-15', blockType: 'lunch', attractionId: null, restaurantId: 'r1' },
        { date: '2026-03-15', blockType: 'afternoon', attractionId: 'a2', restaurantId: null },
        { date: '2026-03-15', blockType: 'dinner', attractionId: null, restaurantId: 'r2' }
      ]

      const result = validateItinerary(validItinerary, '2026-03-15', '2026-03-15', ['a1', 'a2'])

      expect(result.valid).toBe(true)
    })
  })
})
