/**
 * Tests for offline cache utilities
 */

import {
  cacheTripData,
  getCachedTripData,
  cacheCityData,
  getCachedCityData,
  cacheTimeBlocks,
  getCachedTimeBlocks,
  cacheAllVersions,
  getCachedAllVersions,
  clearTripCache,
  clearAllCache,
  getCachedTripIds,
  isTripCached,
  getCacheStats,
  type CachedTripData,
  type CachedCityData,
} from '@/lib/offline/cache'

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Offline Cache', () => {
  beforeEach(() => {
    localStorageMock.clear()
    jest.clearAllMocks()
  })

  describe('cacheTripData / getCachedTripData', () => {
    const mockTripData: CachedTripData = {
      trip: {
        id: 'trip-123',
        user_id: 'user-123',
        destination: 'Paris',
        start_date: '2024-06-01',
        end_date: '2024-06-07',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      travelers: [
        {
          id: 'traveler-1',
          trip_id: 'trip-123',
          name: 'John Doe',
          age: 35,
          relationship: 'self',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      flights: [],
      hotels: [],
      cities: [
        {
          id: 'city-1',
          trip_id: 'trip-123',
          name: 'Paris',
          start_date: '2024-06-01',
          end_date: '2024-06-07',
          order_index: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
      latestVersion: null,
    }

    it('caches and retrieves trip data', () => {
      cacheTripData('trip-123', mockTripData)
      const cached = getCachedTripData('trip-123')

      expect(cached).toEqual(mockTripData)
    })

    it('returns null for non-existent trip', () => {
      const cached = getCachedTripData('non-existent')
      expect(cached).toBeNull()
    })

    it('updates cache metadata with trip ID', () => {
      cacheTripData('trip-123', mockTripData)
      const tripIds = getCachedTripIds()

      expect(tripIds).toContain('trip-123')
    })

    it('handles multiple trips', () => {
      const tripData2: CachedTripData = {
        ...mockTripData,
        trip: { ...mockTripData.trip, id: 'trip-456', destination: 'London' },
      }

      cacheTripData('trip-123', mockTripData)
      cacheTripData('trip-456', tripData2)

      expect(getCachedTripData('trip-123')?.trip.destination).toBe('Paris')
      expect(getCachedTripData('trip-456')?.trip.destination).toBe('London')
    })
  })

  describe('cacheCityData / getCachedCityData', () => {
    const mockCityData: CachedCityData = {
      attractions: [
        {
          id: 'attr-1',
          trip_id: 'trip-123',
          city_id: 'city-1',
          name: 'Eiffel Tower',
          description: 'Famous landmark',
          latitude: 48.8584,
          longitude: 2.2945,
          category: 'landmark',
          highlights: ['iconic', 'view'],
          duration_minutes: 120,
          opening_time: '09:00',
          closing_time: '23:00',
          is_kid_friendly: true,
          image_url: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      restaurants: [
        {
          id: 'rest-1',
          trip_id: 'trip-123',
          city_id: 'city-1',
          name: 'Le Petit Bistro',
          description: 'French cuisine',
          latitude: 48.8566,
          longitude: 2.3522,
          cuisine_type: 'French',
          price_level: 2,
          highlights: ['romantic', 'authentic'],
          opening_time: '12:00',
          closing_time: '22:00',
          is_kid_friendly: true,
          image_url: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      hotel: {
        id: 'hotel-1',
        trip_id: 'trip-123',
        city_id: 'city-1',
        name: 'Hotel Paris',
        address: '123 Champs-Elysees',
        latitude: 48.8738,
        longitude: 2.2950,
        check_in_date: '2024-06-01',
        check_out_date: '2024-06-07',
        created_at: '2024-01-01T00:00:00Z',
      },
    }

    it('caches and retrieves city data', () => {
      cacheCityData('city-1', mockCityData)
      const cached = getCachedCityData('city-1')

      expect(cached).toEqual(mockCityData)
      expect(cached?.attractions).toHaveLength(1)
      expect(cached?.restaurants).toHaveLength(1)
      expect(cached?.hotel?.name).toBe('Hotel Paris')
    })

    it('returns null for non-existent city', () => {
      const cached = getCachedCityData('non-existent')
      expect(cached).toBeNull()
    })

    it('handles city data with null hotel', () => {
      const dataWithoutHotel: CachedCityData = {
        ...mockCityData,
        hotel: null,
      }

      cacheCityData('city-2', dataWithoutHotel)
      const cached = getCachedCityData('city-2')

      expect(cached?.hotel).toBeNull()
    })
  })

  describe('cacheTimeBlocks / getCachedTimeBlocks', () => {
    const mockTimeBlocks = [
      {
        id: 'block-1',
        trip_id: 'trip-123',
        city_id: 'city-1',
        plan_version_id: 'version-1',
        date: '2024-06-01',
        block_type: 'morning' as const,
        start_time: '09:00',
        end_time: '12:00',
        selected_attraction_id: 'attr-1',
        selected_restaurant_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]

    it('caches and retrieves time blocks', () => {
      cacheTimeBlocks('trip-123', 'version-1', mockTimeBlocks)
      const cached = getCachedTimeBlocks('trip-123', 'version-1')

      expect(cached).toEqual(mockTimeBlocks)
    })

    it('returns null for non-existent version', () => {
      const cached = getCachedTimeBlocks('trip-123', 'non-existent')
      expect(cached).toBeNull()
    })

    it('caches multiple versions separately', () => {
      const blocksV2 = [
        { ...mockTimeBlocks[0], id: 'block-2', plan_version_id: 'version-2' },
      ]

      cacheTimeBlocks('trip-123', 'version-1', mockTimeBlocks)
      cacheTimeBlocks('trip-123', 'version-2', blocksV2)

      expect(getCachedTimeBlocks('trip-123', 'version-1')?.[0].id).toBe('block-1')
      expect(getCachedTimeBlocks('trip-123', 'version-2')?.[0].id).toBe('block-2')
    })
  })

  describe('cacheAllVersions / getCachedAllVersions', () => {
    const mockVersions = [
      {
        id: 'version-1',
        trip_id: 'trip-123',
        version_number: 1,
        plan_data: {},
        change_description: 'Initial version',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'version-2',
        trip_id: 'trip-123',
        version_number: 2,
        plan_data: {},
        change_description: 'Updated itinerary',
        created_at: '2024-01-02T00:00:00Z',
      },
    ]

    it('caches and retrieves all versions', () => {
      cacheAllVersions('trip-123', mockVersions)
      const cached = getCachedAllVersions('trip-123')

      expect(cached).toEqual(mockVersions)
      expect(cached).toHaveLength(2)
    })

    it('returns null for non-existent trip versions', () => {
      const cached = getCachedAllVersions('non-existent')
      expect(cached).toBeNull()
    })
  })

  describe('clearTripCache', () => {
    it('removes all cache entries for a specific trip', () => {
      const mockTripData: CachedTripData = {
        trip: {
          id: 'trip-123',
          user_id: 'user-123',
          destination: 'Paris',
          start_date: '2024-06-01',
          end_date: '2024-06-07',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        travelers: [],
        flights: [],
        hotels: [],
        cities: [],
        latestVersion: null,
      }

      cacheTripData('trip-123', mockTripData)
      cacheTimeBlocks('trip-123', 'version-1', [])
      cacheAllVersions('trip-123', [])

      clearTripCache('trip-123')

      expect(getCachedTripData('trip-123')).toBeNull()
      expect(getCachedTimeBlocks('trip-123', 'version-1')).toBeNull()
      expect(getCachedAllVersions('trip-123')).toBeNull()
    })

    it('does not affect other trips', () => {
      const tripData1: CachedTripData = {
        trip: {
          id: 'trip-123',
          user_id: 'user-123',
          destination: 'Paris',
          start_date: '2024-06-01',
          end_date: '2024-06-07',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        travelers: [],
        flights: [],
        hotels: [],
        cities: [],
        latestVersion: null,
      }

      const tripData2: CachedTripData = {
        ...tripData1,
        trip: { ...tripData1.trip, id: 'trip-456', destination: 'London' },
      }

      cacheTripData('trip-123', tripData1)
      cacheTripData('trip-456', tripData2)

      clearTripCache('trip-123')

      expect(getCachedTripData('trip-123')).toBeNull()
      expect(getCachedTripData('trip-456')).not.toBeNull()
    })
  })

  describe('clearAllCache', () => {
    it('removes all cache entries', () => {
      const mockTripData: CachedTripData = {
        trip: {
          id: 'trip-123',
          user_id: 'user-123',
          destination: 'Paris',
          start_date: '2024-06-01',
          end_date: '2024-06-07',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        travelers: [],
        flights: [],
        hotels: [],
        cities: [],
        latestVersion: null,
      }

      cacheTripData('trip-123', mockTripData)
      cacheCityData('city-1', { attractions: [], restaurants: [], hotel: null })

      clearAllCache()

      expect(getCachedTripData('trip-123')).toBeNull()
      expect(getCachedCityData('city-1')).toBeNull()
    })
  })

  describe('isTripCached', () => {
    it('returns true for cached trip', () => {
      const mockTripData: CachedTripData = {
        trip: {
          id: 'trip-123',
          user_id: 'user-123',
          destination: 'Paris',
          start_date: '2024-06-01',
          end_date: '2024-06-07',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        travelers: [],
        flights: [],
        hotels: [],
        cities: [],
        latestVersion: null,
      }

      cacheTripData('trip-123', mockTripData)
      expect(isTripCached('trip-123')).toBe(true)
    })

    it('returns false for non-cached trip', () => {
      expect(isTripCached('non-existent')).toBe(false)
    })
  })

  describe('getCacheStats', () => {
    it('returns correct statistics', () => {
      const mockTripData: CachedTripData = {
        trip: {
          id: 'trip-123',
          user_id: 'user-123',
          destination: 'Paris',
          start_date: '2024-06-01',
          end_date: '2024-06-07',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        travelers: [],
        flights: [],
        hotels: [],
        cities: [],
        latestVersion: null,
      }

      cacheTripData('trip-123', mockTripData)
      cacheTripData('trip-456', mockTripData)

      const stats = getCacheStats()

      expect(stats.tripCount).toBe(2)
      expect(stats.totalEntries).toBeGreaterThan(0)
      expect(stats.totalSizeBytes).toBeGreaterThan(0)
      expect(stats.lastUpdated).toBeGreaterThan(0)
    })

    it('returns zeros for empty cache', () => {
      clearAllCache()
      const stats = getCacheStats()

      expect(stats.tripCount).toBe(0)
      expect(stats.totalEntries).toBe(0)
    })
  })

  describe('cache expiration', () => {
    it('returns null for expired cache entries', () => {
      const mockTripData: CachedTripData = {
        trip: {
          id: 'trip-123',
          user_id: 'user-123',
          destination: 'Paris',
          start_date: '2024-06-01',
          end_date: '2024-06-07',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        travelers: [],
        flights: [],
        hotels: [],
        cities: [],
        latestVersion: null,
      }

      // Manually set an expired cache entry
      const expiredEntry = {
        data: mockTripData,
        timestamp: Date.now() - 1000000000,
        expiresAt: Date.now() - 1000, // Expired
      }

      localStorageMock.setItem(
        'baggins-offline-trip-v1-trip-expired',
        JSON.stringify(expiredEntry)
      )

      const cached = getCachedTripData('trip-expired')
      expect(cached).toBeNull()
    })
  })
})
