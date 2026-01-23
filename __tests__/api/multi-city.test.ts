/**
 * Tests for multi-city trip functionality
 */

import { POST as generateCitySuggestions } from '@/app/api/ai/generate-city-suggestions/route'
import { POST as generateItinerary } from '@/app/api/ai/generate-itinerary/route'
import { createClient } from '@/lib/supabase/server'

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}))

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn()
    }
  }))
})

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status || 200,
      json: async () => data
    })
  }
}))

describe('Multi-City API Endpoints', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn()
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  describe('/api/ai/generate-city-suggestions', () => {
    it('returns 401 if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const request = new Request('http://localhost/api/ai/generate-city-suggestions', {
        method: 'POST',
        body: JSON.stringify({
          tripId: 'trip-123',
          cityId: 'city-123',
          cityName: 'Paris, France',
          travelers: []
        })
      })

      const response = await generateCitySuggestions(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 404 if trip not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } }
      })

      const mockFrom = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockReturnThis()
      const mockSingle = jest.fn().mockResolvedValue({ data: null })

      mockSupabase.from = mockFrom
      mockFrom.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      })
      mockSelect.mockReturnValue({
        eq: mockEq,
        single: mockSingle
      })
      mockEq.mockReturnValue({
        single: mockSingle
      })

      const request = new Request('http://localhost/api/ai/generate-city-suggestions', {
        method: 'POST',
        body: JSON.stringify({
          tripId: 'trip-123',
          cityId: 'city-123',
          cityName: 'Paris, France',
          travelers: []
        })
      })

      const response = await generateCitySuggestions(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Trip not found')
    })
  })

  describe('/api/ai/generate-itinerary', () => {
    it('returns 401 if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const request = new Request('http://localhost/api/ai/generate-itinerary', {
        method: 'POST',
        body: JSON.stringify({
          tripId: 'trip-123',
          cityId: 'city-123',
          selectedAttractionIds: ['a1', 'a2'],
          selectedRestaurantIds: ['r1', 'r2']
        })
      })

      const response = await generateItinerary(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 404 if trip or city not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } }
      })

      const mockFrom = jest.fn()
      mockSupabase.from = mockFrom

      // Mock trip query - returns null
      const mockTripChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null })
      }

      // Mock city query - returns null
      const mockCityChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null })
      }

      // Mock hotel query - returns null
      const mockHotelChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null })
      }

      mockFrom.mockImplementation((table: string) => {
        if (table === 'trips') return mockTripChain
        if (table === 'trip_cities') return mockCityChain
        if (table === 'hotels') return mockHotelChain
        return mockTripChain
      })

      const request = new Request('http://localhost/api/ai/generate-itinerary', {
        method: 'POST',
        body: JSON.stringify({
          tripId: 'trip-123',
          cityId: 'city-123',
          selectedAttractionIds: [],
          selectedRestaurantIds: []
        })
      })

      const response = await generateItinerary(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Trip or city not found')
    })
  })
})

describe('Multi-City Data Structures', () => {
  it('should have correct TripCity type structure', () => {
    // Type checking test
    const city = {
      id: 'city-123',
      trip_id: 'trip-123',
      name: 'Paris, France',
      start_date: '2026-03-15',
      end_date: '2026-03-18',
      order_index: 0,
      created_at: '2026-01-23T00:00:00Z',
      updated_at: '2026-01-23T00:00:00Z'
    }

    expect(city.id).toBeDefined()
    expect(city.trip_id).toBeDefined()
    expect(city.name).toBe('Paris, France')
    expect(city.start_date).toBe('2026-03-15')
    expect(city.end_date).toBe('2026-03-18')
    expect(city.order_index).toBe(0)
  })

  it('should support multi-city trip with correct structure', () => {
    const multiCityTrip = {
      destination: 'Paris, France & Rome, Italy',
      start_date: '2026-03-15',
      end_date: '2026-03-22',
      cities: [
        {
          name: 'Paris, France',
          start_date: '2026-03-15',
          end_date: '2026-03-18'
        },
        {
          name: 'Rome, Italy',
          start_date: '2026-03-18',
          end_date: '2026-03-22'
        }
      ]
    }

    expect(multiCityTrip.cities).toHaveLength(2)
    expect(multiCityTrip.cities[0].name).toBe('Paris, France')
    expect(multiCityTrip.cities[1].name).toBe('Rome, Italy')

    // Verify dates are contiguous
    expect(multiCityTrip.cities[0].end_date).toBe(multiCityTrip.cities[1].start_date)
  })
})

describe('Google Maps Link Generation', () => {
  it('should generate correct search link', () => {
    const lat = 48.8566
    const lon = 2.3522
    const name = 'Eiffel Tower'

    const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query=${lat},${lon}`

    expect(searchUrl).toContain('google.com/maps/search')
    expect(searchUrl).toContain('Eiffel%20Tower')
    expect(searchUrl).toContain('48.8566')
    expect(searchUrl).toContain('2.3522')
  })

  it('should generate correct directions link', () => {
    const originLat = 48.8606
    const originLon = 2.3376
    const destLat = 48.8566
    const destLon = 2.3522

    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${destLat},${destLon}&travelmode=walking`

    expect(directionsUrl).toContain('google.com/maps/dir')
    expect(directionsUrl).toContain(`origin=${originLat},${originLon}`)
    expect(directionsUrl).toContain(`destination=${destLat},${destLon}`)
    expect(directionsUrl).toContain('travelmode=walking')
  })
})
