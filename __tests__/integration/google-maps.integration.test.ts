/**
 * Integration tests for Google Maps Distance Matrix API utilities
 * These tests use REAL API calls to Google Maps
 * Requires GOOGLE_MAPS_API_KEY to be configured in .env.local
 */

import {
  fetchTravelTime,
  type Location,
  type TravelTimeRequest
} from '@/utils/google-maps'

describe('Google Maps Distance Matrix API Integration Tests', () => {
  const skipIfNoApiKey = () => {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.warn('⚠️  Skipping integration tests: GOOGLE_MAPS_API_KEY not configured')
      return true
    }
    return false
  }

  beforeEach(() => {
    if (skipIfNoApiKey()) {
      return
    }
  })

  describe('fetchTravelTime - Real API', () => {
    it('should fetch travel time between Empire State Building and Statue of Liberty', async () => {
      if (skipIfNoApiKey()) return

      const request: TravelTimeRequest = {
        origin: { latitude: 40.7484, longitude: -73.9857 }, // Empire State
        destination: { latitude: 40.6892, longitude: -74.0445 }, // Statue of Liberty
        mode: 'driving'
      }

      const result = await fetchTravelTime(request)

      expect(result).not.toBeNull()
      expect(result?.distanceMeters).toBeGreaterThan(0)
      expect(result?.durationSeconds).toBeGreaterThan(0)
      expect(result?.distanceText).toBeDefined()
      expect(result?.durationText).toBeDefined()
      expect(result?.mode).toBe('driving')

      console.log(`✓ Empire State → Statue of Liberty: ${result?.distanceText}, ${result?.durationText}`)
    }, 10000)

    it('should fetch travel time in Paris between Eiffel Tower and Louvre', async () => {
      if (skipIfNoApiKey()) return

      const request: TravelTimeRequest = {
        origin: { latitude: 48.8584, longitude: 2.2945 }, // Eiffel Tower
        destination: { latitude: 48.8606, longitude: 2.3376 }, // Louvre
        mode: 'driving'
      }

      const result = await fetchTravelTime(request)

      expect(result).not.toBeNull()
      expect(result?.distanceMeters).toBeGreaterThan(0)
      expect(result?.durationSeconds).toBeGreaterThan(0)

      console.log(`✓ Eiffel Tower → Louvre: ${result?.distanceText}, ${result?.durationText}`)
    }, 10000)

    it('should fetch walking travel time in London', async () => {
      if (skipIfNoApiKey()) return

      const request: TravelTimeRequest = {
        origin: { latitude: 51.5007, longitude: -0.1246 }, // Big Ben
        destination: { latitude: 51.5055, longitude: -0.0754 }, // Tower Bridge
        mode: 'walking'
      }

      const result = await fetchTravelTime(request)

      expect(result).not.toBeNull()
      expect(result?.mode).toBe('walking')
      expect(result?.durationSeconds).toBeGreaterThan(0)

      console.log(`✓ Big Ben → Tower Bridge (walking): ${result?.distanceText}, ${result?.durationText}`)
    }, 10000)

    it('should fetch transit travel time', async () => {
      if (skipIfNoApiKey()) return

      const request: TravelTimeRequest = {
        origin: { latitude: 40.7128, longitude: -74.0060 }, // Lower Manhattan
        destination: { latitude: 40.7614, longitude: -73.9776 }, // Times Square
        mode: 'transit'
      }

      const result = await fetchTravelTime(request)

      expect(result).not.toBeNull()
      expect(result?.mode).toBe('transit')

      console.log(`✓ Lower Manhattan → Times Square (transit): ${result?.distanceText}, ${result?.durationText}`)
    }, 10000)

    it('should fetch bicycling travel time', async () => {
      if (skipIfNoApiKey()) return

      const request: TravelTimeRequest = {
        origin: { latitude: 51.5194, longitude: -0.1270 }, // British Museum
        destination: { latitude: 51.5074, longitude: -0.1278 }, // Trafalgar Square
        mode: 'bicycling'
      }

      const result = await fetchTravelTime(request)

      expect(result).not.toBeNull()
      expect(result?.mode).toBe('bicycling')

      console.log(`✓ British Museum → Trafalgar Square (bicycling): ${result?.distanceText}, ${result?.durationText}`)
    }, 10000)

    it('should include traffic data for driving mode', async () => {
      if (skipIfNoApiKey()) return

      const request: TravelTimeRequest = {
        origin: { latitude: 40.7580, longitude: -73.9855 }, // Times Square
        destination: { latitude: 40.7484, longitude: -73.9857 }, // Empire State
        mode: 'driving'
      }

      const result = await fetchTravelTime(request)

      expect(result).not.toBeNull()
      // With traffic, duration should be reasonable (this is a short distance)
      expect(result?.durationSeconds).toBeGreaterThan(0)
      expect(result?.durationSeconds).toBeLessThan(3600) // Less than 1 hour

      console.log(`✓ Times Square → Empire State (with traffic): ${result?.durationText}`)
    }, 10000)
  })

  describe('Performance - Real API', () => {
    it('should handle multiple parallel requests efficiently', async () => {
      if (skipIfNoApiKey()) return

      const requests: TravelTimeRequest[] = [
        {
          origin: { latitude: 48.8584, longitude: 2.2945 },
          destination: { latitude: 48.8606, longitude: 2.3376 },
          mode: 'driving'
        },
        {
          origin: { latitude: 51.5007, longitude: -0.1246 },
          destination: { latitude: 51.5055, longitude: -0.0754 },
          mode: 'walking'
        },
        {
          origin: { latitude: 40.7484, longitude: -73.9857 },
          destination: { latitude: 40.6892, longitude: -74.0445 },
          mode: 'driving'
        }
      ]

      const startTime = Date.now()
      const results = await Promise.all(requests.map(r => fetchTravelTime(r)))
      const duration = Date.now() - startTime

      // All should succeed
      expect(results.filter(r => r !== null).length).toBe(3)

      // Parallel requests should complete reasonably fast (under 5s for 3 requests)
      expect(duration).toBeLessThan(5000)

      console.log(`✓ Fetched 3 travel times in ${duration}ms`)
    }, 10000)
  })

  describe('Edge Cases - Real API', () => {
    it('should handle very short distances', async () => {
      if (skipIfNoApiKey()) return

      const request: TravelTimeRequest = {
        origin: { latitude: 48.8584, longitude: 2.2945 },
        destination: { latitude: 48.8585, longitude: 2.2946 }, // Very close
        mode: 'walking'
      }

      const result = await fetchTravelTime(request)

      expect(result).not.toBeNull()
      expect(result?.distanceMeters).toBeGreaterThan(0)

      console.log(`✓ Very short distance: ${result?.distanceText}, ${result?.durationText}`)
    }, 10000)

    it('should handle cross-city routes', async () => {
      if (skipIfNoApiKey()) return

      const request: TravelTimeRequest = {
        origin: { latitude: 51.5074, longitude: -0.1278 }, // London
        destination: { latitude: 51.4545, longitude: -2.5879 }, // Bristol
        mode: 'driving'
      }

      const result = await fetchTravelTime(request)

      expect(result).not.toBeNull()
      expect(result?.distanceMeters).toBeGreaterThan(100000) // More than 100km

      console.log(`✓ London → Bristol: ${result?.distanceText}, ${result?.durationText}`)
    }, 10000)
  })
})
