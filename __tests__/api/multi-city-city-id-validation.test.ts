/**
 * Regression test for multi-city attraction city_id assignment bug
 *
 * Bug Report: Multi-city trips (e.g., Santiago & Pucón) were not showing attractions
 * for the first city.
 *
 * Root Cause: The generateCitySuggestions function was not validating that city_id
 * was present before inserting attractions. If city_id was somehow null or undefined
 * due to a bug in the caller, attractions would be created without a city_id, causing
 * them to not appear in the UI (which filters by city_id).
 *
 * Fix: Added defensive validation in both parse-trip/route.ts and generate-suggestions.ts
 * to ensure city_id is never null and matches the expected value.
 */

import { generateCitySuggestions } from '@/lib/ai/generate-suggestions'

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            attractions: [
              {
                name: 'Plaza de Armas',
                description: 'Historic main square',
                category: 'landmark',
                latitude: -33.4372,
                longitude: -70.6506,
                opening_time: null,
                closing_time: null,
                duration_minutes: 60,
                is_kid_friendly: true,
                min_age: null,
                highlights: ['historic', 'central'],
                image_search_term: 'Plaza de Armas Santiago'
              }
            ],
            restaurants: [
              {
                name: 'Donde Augusto',
                description: 'Traditional Chilean cuisine',
                cuisine_type: 'Chilean',
                latitude: -33.4429,
                longitude: -70.6542,
                opening_time: '12:00',
                closing_time: '22:00',
                price_level: 2,
                is_kid_friendly: true,
                highlights: ['authentic', 'local'],
                image_search_term: 'Chilean restaurant'
              }
            ]
          })
        }]
      })
    }
  }))
})

// Mock Google Places
jest.mock('@/utils/google-places', () => ({
  getPlacePhotoUrl: jest.fn().mockResolvedValue(null)
}))

describe('Multi-City city_id Validation (Bug Fix)', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should reject attractions with null city_id', async () => {
    // This test verifies the fix prevents the bug from happening

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis()
    }

    // Try to call with null city_id (simulating the bug condition)
    await expect(
      generateCitySuggestions({
        supabase: mockSupabase,
        tripId: 'trip-123',
        cityId: null as any, // Simulate null city_id
        cityName: 'Santiago',
        travelers: []
      })
    ).rejects.toThrow('cityId is required')
  })

  it('should reject attractions with undefined city_id', async () => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis()
    }

    // Try to call with undefined city_id
    await expect(
      generateCitySuggestions({
        supabase: mockSupabase,
        tripId: 'trip-123',
        cityId: undefined as any,
        cityName: 'Santiago',
        travelers: []
      })
    ).rejects.toThrow('cityId is required')
  })

  it('should reject attractions with empty string city_id', async () => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis()
    }

    // Try to call with empty string city_id
    await expect(
      generateCitySuggestions({
        supabase: mockSupabase,
        tripId: 'trip-123',
        cityId: '' as any,
        cityName: 'Santiago',
        travelers: []
      })
    ).rejects.toThrow('cityId is required')
  })

  it('should validate all attractions have city_id before inserting', async () => {
    let insertedData: any[] = []

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'attractions') {
          return {
            insert: jest.fn((data: any[]) => {
              insertedData = data
              return {
                select: jest.fn().mockResolvedValue({
                  data: data.map((d, i) => ({ ...d, id: `attr-${i}` })),
                  error: null
                })
              }
            })
          }
        } else if (table === 'restaurants') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn().mockResolvedValue({ data: [], error: null })
            }))
          }
        }
        return mockSupabase
      })
    }

    const cityId = 'valid-city-id-123'

    await generateCitySuggestions({
      supabase: mockSupabase,
      tripId: 'trip-123',
      cityId,
      cityName: 'Santiago, Chile',
      travelers: []
    })

    // Verify all inserted attractions have the correct city_id
    expect(insertedData.length).toBeGreaterThan(0)
    insertedData.forEach(attr => {
      expect(attr.city_id).toBe(cityId)
      expect(attr.city_id).not.toBeNull()
      expect(attr.city_id).not.toBeUndefined()
      expect(attr.city_id).not.toBe('')
    })
  })

  it('should validate tripId is present', async () => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis()
    }

    await expect(
      generateCitySuggestions({
        supabase: mockSupabase,
        tripId: null as any,
        cityId: 'city-123',
        cityName: 'Santiago',
        travelers: []
      })
    ).rejects.toThrow('tripId is required')
  })

  it('should validate cityName is present', async () => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis()
    }

    await expect(
      generateCitySuggestions({
        supabase: mockSupabase,
        tripId: 'trip-123',
        cityId: 'city-123',
        cityName: null as any,
        travelers: []
      })
    ).rejects.toThrow('cityName is required')
  })

  it('should log detailed information during suggestion generation', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log')

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'attractions') {
          return {
            insert: jest.fn((data: any[]) => ({
              select: jest.fn().mockResolvedValue({
                data: data.map((d, i) => ({ ...d, id: `attr-${i}` })),
                error: null
              })
            }))
          }
        } else if (table === 'restaurants') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn().mockResolvedValue({ data: [], error: null })
            }))
          }
        }
        return mockSupabase
      })
    }

    await generateCitySuggestions({
      supabase: mockSupabase,
      tripId: 'trip-123',
      cityId: 'city-123',
      cityName: 'Santiago, Chile',
      travelers: []
    })

    // Verify logging includes city information
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[generateCitySuggestions] Starting for city "Santiago, Chile"')
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✓ Inserted')
    )

    consoleLogSpy.mockRestore()
  })

  describe('Documentation: Why this bug occurred', () => {
    it('should document the flow that could cause null city_id', () => {
      const bugScenario = {
        step1: 'Cities are inserted into trip_cities table',
        step2: 'Cities are re-fetched from database with .select()',
        step3: 'For each city, generateCitySuggestions is called',
        step4: 'If city object is malformed, city.id could be undefined',
        step5: 'Without validation, attractions created with city_id=undefined',
        step6: 'Database accepts NULL for city_id (backward compatibility)',
        step7: 'UI queries WHERE city_id = <specific-id>',
        step8: 'NULL values don\'t match, so attractions don\'t appear'
      }

      expect(Object.keys(bugScenario)).toHaveLength(8)
      expect(bugScenario.step8).toContain('don\'t appear')
    })

    it('should document the fix', () => {
      const fix = {
        where: [
          'lib/ai/generate-suggestions.ts: validate params at function entry',
          'lib/ai/generate-suggestions.ts: validate attractions before insert',
          'lib/ai/generate-suggestions.ts: verify attractions after insert',
          'app/api/ai/parse-trip/route.ts: validate cities before loop',
          'app/api/ai/parse-trip/route.ts: verify attractions after generation'
        ],
        how: [
          'Check cityId, tripId, cityName are truthy',
          'Throw error if any required param is missing',
          'Filter out any attractions with null/undefined city_id',
          'Log detailed information at each step',
          'Verify inserted data matches expected city_id'
        ],
        why: [
          'Fail fast rather than silently creating broken data',
          'Provide clear error messages for debugging',
          'Ensure data integrity at every step',
          'Make the bug impossible to introduce again'
        ]
      }

      expect(fix.where.length).toBe(5)
      expect(fix.how.length).toBe(5)
      expect(fix.why.length).toBe(4)
    })
  })
})
