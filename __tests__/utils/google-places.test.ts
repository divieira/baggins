/**
 * Tests for Google Places API utilities
 */

import {
  searchPlace,
  getPlacePhoto,
  getPlacePhotoUrl,
  type PlaceSearchResult,
  type PlacesTextSearchResponse
} from '@/utils/google-places'

describe('Google Places Utilities', () => {
  describe('searchPlace', () => {
    const mockSuccessResponse: PlacesTextSearchResponse = {
      results: [
        {
          place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
          name: 'Natural History Museum',
          formatted_address: 'Cromwell Rd, South Kensington, London SW7 5BD',
          photos: [
            {
              photo_reference: 'mock-photo-ref-123',
              height: 3024,
              width: 4032
            }
          ]
        }
      ],
      status: 'OK'
    }

    beforeEach(() => {
      delete process.env.GOOGLE_MAPS_API_KEY
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('returns null when API key is not configured', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await searchPlace('Natural History Museum', 51.4966, -0.1764)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'GOOGLE_MAPS_API_KEY not configured, cannot search for place photos'
      )

      consoleSpy.mockRestore()
    })

    it('successfully searches for a place', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const result = await searchPlace('Natural History Museum', 51.4966, -0.1764)

      expect(result).toEqual(mockSuccessResponse.results[0])
    })

    it('constructs correct API URL with query and location', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      await searchPlace('Natural History Museum', 51.4966, -0.1764)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      // Decode URL and replace + with spaces for full decoding
      const decodedUrl = decodeURIComponent(fetchCall).replace(/\+/g, ' ')

      expect(fetchCall).toContain('https://maps.googleapis.com/maps/api/place/textsearch/json')
      expect(decodedUrl).toContain('location=51.4966,-0.1764')
      expect(decodedUrl).toContain('radius=500')
      expect(decodedUrl).toContain('key=test-api-key')
      expect(decodedUrl).toContain('query=Natural History Museum')
    })

    it('returns null when no results found', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ZERO_RESULTS', results: [] })
      })

      const result = await searchPlace('Nonexistent Place', 0, 0)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No place found for: Nonexistent Place')
      )

      consoleSpy.mockRestore()
    })

    it('handles API response with non-OK status', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })

      const result = await searchPlace('Test Place', 0, 0)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles Places API error status', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'REQUEST_DENIED', results: [] })
      })

      const result = await searchPlace('Test Place', 0, 0)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles network errors', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await searchPlace('Test Place', 0, 0)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error searching for place:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('handles special characters in place name', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      await searchPlace('Café de l\'Homme & Bar', 48.8584, 2.2945)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(fetchCall).toContain('https://maps.googleapis.com/maps/api/place/textsearch/json')
    })

    it('handles negative coordinates', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      await searchPlace('Sydney Opera House', -33.8568, 151.2153)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      const decodedUrl = decodeURIComponent(fetchCall)
      expect(decodedUrl).toContain('location=-33.8568,151.2153')
    })
  })

  describe('getPlacePhoto', () => {
    const mockDetailsResponse = {
      result: {
        photos: [
          {
            photo_reference: 'mock-photo-ref-456',
            height: 2048,
            width: 1536
          }
        ]
      },
      status: 'OK'
    }

    beforeEach(() => {
      delete process.env.GOOGLE_MAPS_API_KEY
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('returns null when API key is not configured', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await getPlacePhoto('ChIJN1t_tDeuEmsRUsoyG83frY4')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'GOOGLE_MAPS_API_KEY not configured, cannot fetch place photos'
      )

      consoleSpy.mockRestore()
    })

    it('successfully fetches place photo URL', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailsResponse
      })

      const result = await getPlacePhoto('ChIJN1t_tDeuEmsRUsoyG83frY4')

      expect(result).toContain('https://maps.googleapis.com/maps/api/place/photo')
      expect(result).toContain('maxwidth=800')
      expect(result).toContain('photo_reference=mock-photo-ref-456')
      expect(result).toContain('key=test-api-key')
    })

    it('constructs correct Place Details API URL', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailsResponse
      })

      await getPlacePhoto('ChIJN1t_tDeuEmsRUsoyG83frY4')

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      const decodedUrl = decodeURIComponent(fetchCall)

      expect(fetchCall).toContain('https://maps.googleapis.com/maps/api/place/details/json')
      expect(decodedUrl).toContain('place_id=ChIJN1t_tDeuEmsRUsoyG83frY4')
      expect(decodedUrl).toContain('fields=photos')
      expect(decodedUrl).toContain('key=test-api-key')
    })

    it('returns null when place has no photos', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: {}, status: 'OK' })
      })

      const result = await getPlacePhoto('ChIJN1t_tDeuEmsRUsoyG83frY4')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No photos found for place_id')
      )

      consoleSpy.mockRestore()
    })

    it('returns null when photos array is empty', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { photos: [] }, status: 'OK' })
      })

      const result = await getPlacePhoto('ChIJN1t_tDeuEmsRUsoyG83frY4')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles API response with non-OK status', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })

      const result = await getPlacePhoto('invalid-place-id')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles Place Details API error status', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'NOT_FOUND' })
      })

      const result = await getPlacePhoto('invalid-place-id')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles network errors', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await getPlacePhoto('ChIJN1t_tDeuEmsRUsoyG83frY4')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching place photo:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('getPlacePhotoUrl', () => {
    const mockSearchResponse: PlacesTextSearchResponse = {
      results: [
        {
          place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
          name: 'Natural History Museum',
          formatted_address: 'Cromwell Rd, South Kensington, London SW7 5BD',
          photos: [
            {
              photo_reference: 'mock-search-photo-ref',
              height: 3024,
              width: 4032
            }
          ]
        }
      ],
      status: 'OK'
    }

    const mockDetailsResponse = {
      result: {
        photos: [
          {
            photo_reference: 'mock-details-photo-ref',
            height: 2048,
            width: 1536
          }
        ]
      },
      status: 'OK'
    }

    beforeEach(() => {
      delete process.env.GOOGLE_MAPS_API_KEY
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('returns null when API key is not configured', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await getPlacePhotoUrl('Natural History Museum', 51.4966, -0.1764)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'GOOGLE_MAPS_API_KEY not configured, cannot search for place photos'
      )

      consoleSpy.mockRestore()
    })

    it('successfully returns photo URL from search results', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse
      })

      const result = await getPlacePhotoUrl('Natural History Museum', 51.4966, -0.1764)

      expect(result).toContain('https://maps.googleapis.com/maps/api/place/photo')
      expect(result).toContain('maxwidth=800')
      expect(result).toContain('photo_reference=mock-search-photo-ref')
      expect(result).toContain('key=test-api-key')

      // Should only call search API, not details API
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('falls back to details API when search has no photos', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      const searchResponseNoPhotos = {
        results: [
          {
            place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
            name: 'Natural History Museum',
            formatted_address: 'Cromwell Rd, South Kensington, London SW7 5BD'
          }
        ],
        status: 'OK'
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => searchResponseNoPhotos
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDetailsResponse
        })

      const result = await getPlacePhotoUrl('Natural History Museum', 51.4966, -0.1764)

      expect(result).toContain('photo_reference=mock-details-photo-ref')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('returns null when place not found', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ZERO_RESULTS', results: [] })
      })

      const result = await getPlacePhotoUrl('Nonexistent Place', 0, 0)

      expect(result).toBeNull()
    })

    it('returns null when search fails and no place_id available', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await getPlacePhotoUrl('Test Place', 0, 0)

      expect(result).toBeNull()
      consoleSpy.mockRestore()
    })

    it('handles end-to-end success flow', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse
      })

      const result = await getPlacePhotoUrl('Natural History Museum', 51.4966, -0.1764)

      expect(result).not.toBeNull()
      expect(result).toContain('googleapis.com')
      expect(result).toContain('photo')
    })

    it('handles multiple photos and selects first one', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      const multiPhotoResponse = {
        results: [
          {
            place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
            name: 'Natural History Museum',
            formatted_address: 'Cromwell Rd, South Kensington, London SW7 5BD',
            photos: [
              { photo_reference: 'first-photo-ref', height: 3024, width: 4032 },
              { photo_reference: 'second-photo-ref', height: 2048, width: 1536 },
              { photo_reference: 'third-photo-ref', height: 1024, width: 768 }
            ]
          }
        ],
        status: 'OK'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => multiPhotoResponse
      })

      const result = await getPlacePhotoUrl('Natural History Museum', 51.4966, -0.1764)

      expect(result).toContain('photo_reference=first-photo-ref')
    })
  })
})
