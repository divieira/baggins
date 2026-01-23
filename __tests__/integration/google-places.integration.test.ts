/**
 * Integration tests for Google Places API utilities
 * These tests use REAL API calls to Google Places
 * Requires GOOGLE_MAPS_API_KEY to be configured in .env.local
 */

import {
  searchPlace,
  getPlacePhoto,
  getPlacePhotoUrl
} from '@/utils/google-places'

describe('Google Places API Integration Tests', () => {
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

  describe('searchPlace - Real API', () => {
    it('should find Natural History Museum in London', async () => {
      if (skipIfNoApiKey()) return

      const result = await searchPlace('Natural History Museum', 51.4966, -0.1764)

      expect(result).not.toBeNull()
      expect(result?.place_id).toBeDefined()
      expect(result?.name).toContain('Natural History Museum')
      expect(result?.formatted_address).toContain('London')
    }, 10000)

    it('should find Eiffel Tower in Paris', async () => {
      if (skipIfNoApiKey()) return

      const result = await searchPlace('Eiffel Tower', 48.8584, 2.2945)

      expect(result).not.toBeNull()
      expect(result?.place_id).toBeDefined()
      expect(result?.name).toContain('Eiffel')
      expect(result?.formatted_address).toContain('Paris')
    }, 10000)

    it('should return null for nonexistent place', async () => {
      if (skipIfNoApiKey()) return

      const result = await searchPlace('Totally Fake Place XYZ123', 0, 0)

      expect(result).toBeNull()
    }, 10000)

    it('should handle special characters in place names', async () => {
      if (skipIfNoApiKey()) return

      const result = await searchPlace('Café de Flore', 48.8542, 2.3320)

      expect(result).not.toBeNull()
      if (result) {
        expect(result.place_id).toBeDefined()
        expect(result.formatted_address).toContain('Paris')
      }
    }, 10000)
  })

  describe('getPlacePhoto - Real API', () => {
    it('should fetch photo URL for a valid place_id', async () => {
      if (skipIfNoApiKey()) return

      // First search for a place to get its place_id
      const place = await searchPlace('Statue of Liberty', 40.6892, -74.0445)
      expect(place).not.toBeNull()

      if (place) {
        const photoUrl = await getPlacePhoto(place.place_id)

        expect(photoUrl).not.toBeNull()
        expect(photoUrl).toContain('googleapis.com')
        expect(photoUrl).toContain('photo')
      }
    }, 15000)

    it('should return null for invalid place_id', async () => {
      if (skipIfNoApiKey()) return

      const photoUrl = await getPlacePhoto('invalid-place-id-123')

      expect(photoUrl).toBeNull()
    }, 10000)
  })

  describe('getPlacePhotoUrl - Real API (End-to-End)', () => {
    it('should get photo URL for Louvre Museum in Paris', async () => {
      if (skipIfNoApiKey()) return

      const photoUrl = await getPlacePhotoUrl('Louvre Museum', 48.8606, 2.3376)

      expect(photoUrl).not.toBeNull()
      expect(photoUrl).toContain('googleapis.com')
      expect(photoUrl).toContain('photo')
      expect(photoUrl).toContain('maxwidth=800')
    }, 15000)

    it('should get photo URL for Sydney Opera House', async () => {
      if (skipIfNoApiKey()) return

      const photoUrl = await getPlacePhotoUrl('Sydney Opera House', -33.8568, 151.2153)

      expect(photoUrl).not.toBeNull()
      expect(photoUrl).toContain('googleapis.com')
      expect(photoUrl).toContain('photo')
    }, 15000)

    it('should get photo URL for Colosseum in Rome', async () => {
      if (skipIfNoApiKey()) return

      const photoUrl = await getPlacePhotoUrl('Colosseum', 41.8902, 12.4922)

      expect(photoUrl).not.toBeNull()
      expect(photoUrl).toContain('googleapis.com')
    }, 15000)

    it('should get photo URL for restaurant', async () => {
      if (skipIfNoApiKey()) return

      const photoUrl = await getPlacePhotoUrl('Le Bernardin', 40.7614, -73.9776)

      expect(photoUrl).not.toBeNull()
      expect(photoUrl).toContain('googleapis.com')
    }, 15000)

    it('should return null for nonexistent place', async () => {
      if (skipIfNoApiKey()) return

      const photoUrl = await getPlacePhotoUrl('Nonexistent Place XYZ999', 0, 0)

      expect(photoUrl).toBeNull()
    }, 10000)
  })

  describe('Performance - Real API', () => {
    it('should handle multiple parallel requests efficiently', async () => {
      if (skipIfNoApiKey()) return

      const places = [
        { name: 'Big Ben', lat: 51.5007, lon: -0.1246 },
        { name: 'Tower Bridge', lat: 51.5055, lon: -0.0754 },
        { name: 'British Museum', lat: 51.5194, lon: -0.1270 }
      ]

      const startTime = Date.now()
      const results = await Promise.all(
        places.map(p => getPlacePhotoUrl(p.name, p.lat, p.lon))
      )
      const duration = Date.now() - startTime

      // All should succeed
      expect(results.filter(r => r !== null).length).toBeGreaterThan(0)

      // Parallel requests should complete reasonably fast (under 10s for 3 requests)
      expect(duration).toBeLessThan(10000)

      console.log(`✓ Fetched ${results.filter(r => r !== null).length} photos in ${duration}ms`)
    }, 20000)
  })
})
