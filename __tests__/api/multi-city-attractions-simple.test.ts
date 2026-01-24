/**
 * Unit test for multi-city attraction generation logic
 * Tests that the city_id is correctly assigned to attractions
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
                name: 'Test Attraction 1',
                description: 'Description 1',
                category: 'museum',
                latitude: -33.4172,
                longitude: -70.5476,
                opening_time: '09:00',
                closing_time: '18:00',
                duration_minutes: 120,
                is_kid_friendly: true,
                min_age: null,
                highlights: ['test1', 'test2'],
                image_search_term: 'test attraction'
              },
              {
                name: 'Test Attraction 2',
                description: 'Description 2',
                category: 'park',
                latitude: -33.4233,
                longitude: -70.6344,
                opening_time: '08:00',
                closing_time: '20:00',
                duration_minutes: 90,
                is_kid_friendly: true,
                min_age: null,
                highlights: ['test3', 'test4'],
                image_search_term: 'test park'
              }
            ],
            restaurants: [
              {
                name: 'Test Restaurant 1',
                description: 'Restaurant description',
                cuisine_type: 'Chilean',
                latitude: -33.4429,
                longitude: -70.6542,
                opening_time: '12:00',
                closing_time: '22:00',
                price_level: 2,
                is_kid_friendly: true,
                highlights: ['good food', 'nice ambiance'],
                image_search_term: 'chilean restaurant'
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
  getPlacePhotoUrl: jest.fn().mockResolvedValue(null) // Return null to use fallback
}))

describe('Multi-City Attraction Generation Logic', () => {
  let mockSupabase: any
  const tripId = 'test-trip-id'
  const santiagoCity = {
    id: 'santiago-city-id',
    name: 'Santiago, Chile'
  }
  const puconCity = {
    id: 'pucon-city-id',
    name: 'Pucón, Chile'
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    }
  })

  it('should assign correct city_id to Santiago attractions', async () => {
    let insertedAttractions: any[] = []
    let insertedRestaurants: any[] = []

    // Mock the insert to capture what's being inserted
    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attractions') {
        return {
          insert: jest.fn((data: any[]) => {
            insertedAttractions = data
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
          insert: jest.fn((data: any[]) => {
            insertedRestaurants = data
            return {
              select: jest.fn().mockResolvedValue({
                data: data.map((d, i) => ({ ...d, id: `rest-${i}` })),
                error: null
              })
            }
          })
        }
      }
      return mockSupabase
    })

    await generateCitySuggestions({
      supabase: mockSupabase,
      tripId,
      cityId: santiagoCity.id,
      cityName: santiagoCity.name,
      travelers: [
        { name: 'Diego', age: 35 },
        { name: 'Stephanie', age: 32 },
        { name: 'Oliver', age: 3 },
        { name: 'Thomas', age: 1 }
      ]
    })

    // Verify attractions were inserted with correct city_id
    expect(insertedAttractions).toHaveLength(2)
    insertedAttractions.forEach(attr => {
      expect(attr.trip_id).toBe(tripId)
      expect(attr.city_id).toBe(santiagoCity.id) // CRITICAL: Must be Santiago's city_id
      expect(attr.city_id).not.toBeNull()
      expect(attr.city_id).not.toBeUndefined()
    })

    // Verify restaurants were inserted with correct city_id
    expect(insertedRestaurants).toHaveLength(1)
    insertedRestaurants.forEach(rest => {
      expect(rest.trip_id).toBe(tripId)
      expect(rest.city_id).toBe(santiagoCity.id) // CRITICAL: Must be Santiago's city_id
      expect(rest.city_id).not.toBeNull()
      expect(rest.city_id).not.toBeUndefined()
    })
  })

  it('should assign correct city_id to Pucón attractions', async () => {
    let insertedAttractions: any[] = []

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attractions') {
        return {
          insert: jest.fn((data: any[]) => {
            insertedAttractions = data
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
          insert: jest.fn((data: any[]) => {
            return {
              select: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            }
          })
        }
      }
      return mockSupabase
    })

    await generateCitySuggestions({
      supabase: mockSupabase,
      tripId,
      cityId: puconCity.id, // Different city_id
      cityName: puconCity.name,
      travelers: []
    })

    // Verify attractions were inserted with Pucón's city_id (not Santiago's)
    expect(insertedAttractions).toHaveLength(2)
    insertedAttractions.forEach(attr => {
      expect(attr.trip_id).toBe(tripId)
      expect(attr.city_id).toBe(puconCity.id) // CRITICAL: Must be Pucón's city_id
      expect(attr.city_id).not.toBe(santiagoCity.id) // Must NOT be Santiago's
    })
  })

  it('should handle generation for multiple cities with distinct city_ids', async () => {
    const generatedData: { cityId: string; attractions: any[] }[] = []

    // Track all insertions
    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attractions') {
        return {
          insert: jest.fn((data: any[]) => {
            if (data.length > 0) {
              generatedData.push({
                cityId: data[0].city_id,
                attractions: data
              })
            }
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

    // Generate for Santiago
    await generateCitySuggestions({
      supabase: mockSupabase,
      tripId,
      cityId: santiagoCity.id,
      cityName: santiagoCity.name,
      travelers: []
    })

    // Generate for Pucón
    await generateCitySuggestions({
      supabase: mockSupabase,
      tripId,
      cityId: puconCity.id,
      cityName: puconCity.name,
      travelers: []
    })

    // Verify we have two separate generations
    expect(generatedData).toHaveLength(2)

    // Verify Santiago attractions
    const santiagoData = generatedData.find(d => d.cityId === santiagoCity.id)
    expect(santiagoData).toBeDefined()
    expect(santiagoData!.attractions.length).toBeGreaterThan(0)
    santiagoData!.attractions.forEach(attr => {
      expect(attr.city_id).toBe(santiagoCity.id)
    })

    // Verify Pucón attractions
    const puconData = generatedData.find(d => d.cityId === puconCity.id)
    expect(puconData).toBeDefined()
    expect(puconData!.attractions.length).toBeGreaterThan(0)
    puconData!.attractions.forEach(attr => {
      expect(attr.city_id).toBe(puconCity.id)
    })
  })
})
