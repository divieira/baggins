/**
 * Tests for Google Maps utilities
 */

import {
  generateMapsSearchLink,
  generateMapsDirectionsLink,
  fetchTravelTime,
  secondsToMinutes,
  formatTravelTimeText,
  type Location,
  type TravelTimeRequest,
  type DistanceMatrixResponse
} from '@/utils/google-maps'

describe('Google Maps Utilities', () => {
  describe('generateMapsSearchLink', () => {
    it('generates search link with place name', () => {
      const location: Location = { latitude: 40.7128, longitude: -74.0060 }
      const link = generateMapsSearchLink(location, 'Empire State Building')

      expect(link).toBe('https://www.google.com/maps/search/?api=1&query=Empire%20State%20Building')
    })

    it('generates search link with coordinates when no place name provided', () => {
      const location: Location = { latitude: 40.7128, longitude: -74.0060 }
      const link = generateMapsSearchLink(location)

      expect(link).toBe('https://www.google.com/maps/search/?api=1&query=40.7128,-74.006')
    })

    it('handles special characters in place name', () => {
      const location: Location = { latitude: 48.8584, longitude: 2.2945 }
      const link = generateMapsSearchLink(location, 'Café de l\'Homme & Bar')

      expect(link).toContain('https://www.google.com/maps/search/?api=1&query=')
      expect(decodeURIComponent(link)).toContain('Café de l\'Homme & Bar')
    })

    it('handles negative coordinates', () => {
      const location: Location = { latitude: -33.8688, longitude: 151.2093 }
      const link = generateMapsSearchLink(location)

      expect(link).toBe('https://www.google.com/maps/search/?api=1&query=-33.8688,151.2093')
    })
  })

  describe('generateMapsDirectionsLink', () => {
    const origin: Location = { latitude: 40.7128, longitude: -74.0060 }
    const destination: Location = { latitude: 40.7614, longitude: -73.9776 }

    it('generates directions link with default driving mode', () => {
      const link = generateMapsDirectionsLink(origin, destination)

      expect(link).toBe(
        'https://www.google.com/maps/dir/?api=1&origin=40.7128,-74.006&destination=40.7614,-73.9776&travelmode=driving'
      )
    })

    it('generates directions link with walking mode', () => {
      const link = generateMapsDirectionsLink(origin, destination, 'walking')

      expect(link).toContain('travelmode=walking')
    })

    it('generates directions link with transit mode', () => {
      const link = generateMapsDirectionsLink(origin, destination, 'transit')

      expect(link).toContain('travelmode=transit')
    })

    it('generates directions link with bicycling mode', () => {
      const link = generateMapsDirectionsLink(origin, destination, 'bicycling')

      expect(link).toContain('travelmode=bicycling')
    })

    it('handles same origin and destination', () => {
      const sameLocation: Location = { latitude: 40.7128, longitude: -74.0060 }
      const link = generateMapsDirectionsLink(sameLocation, sameLocation)

      expect(link).toContain('origin=40.7128,-74.006')
      expect(link).toContain('destination=40.7128,-74.006')
    })
  })

  describe('fetchTravelTime', () => {
    const mockRequest: TravelTimeRequest = {
      origin: { latitude: 40.7128, longitude: -74.0060 },
      destination: { latitude: 40.7614, longitude: -73.9776 },
      mode: 'driving'
    }

    const mockSuccessResponse: DistanceMatrixResponse = {
      rows: [
        {
          elements: [
            {
              status: 'OK',
              distance: {
                value: 8046,
                text: '5.0 mi'
              },
              duration: {
                value: 1200,
                text: '20 mins'
              },
              duration_in_traffic: {
                value: 1500,
                text: '25 mins'
              }
            }
          ]
        }
      ],
      status: 'OK'
    }

    beforeEach(() => {
      // Reset environment variable and fetch mock
      delete process.env.GOOGLE_MAPS_API_KEY
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('returns null when API key is not configured', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await fetchTravelTime(mockRequest)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'GOOGLE_MAPS_API_KEY not configured, falling back to estimation'
      )

      consoleSpy.mockRestore()
    })

    it('successfully fetches travel time with traffic data', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const result = await fetchTravelTime(mockRequest)

      expect(result).toEqual({
        distanceMeters: 8046,
        distanceText: '5.0 mi',
        durationSeconds: 1500, // Uses duration_in_traffic
        durationText: '25 mins',
        mode: 'driving'
      })
    })

    it('uses regular duration when duration_in_traffic not available', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      const responseWithoutTraffic = {
        ...mockSuccessResponse,
        rows: [
          {
            elements: [
              {
                status: 'OK',
                distance: { value: 8046, text: '5.0 mi' },
                duration: { value: 1200, text: '20 mins' }
              }
            ]
          }
        ]
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => responseWithoutTraffic
      })

      const result = await fetchTravelTime(mockRequest)

      expect(result?.durationSeconds).toBe(1200)
      expect(result?.durationText).toBe('20 mins')
    })

    it('includes departure_time parameter for driving mode', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      await fetchTravelTime(mockRequest)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(fetchCall).toContain('departure_time=now')
    })

    it('includes departure_time parameter for transit mode', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      await fetchTravelTime({ ...mockRequest, mode: 'transit' })

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(fetchCall).toContain('departure_time=now')
    })

    it('does not include departure_time for walking mode', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      await fetchTravelTime({ ...mockRequest, mode: 'walking' })

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(fetchCall).not.toContain('departure_time')
    })

    it('handles API response with non-OK status', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })

      const result = await fetchTravelTime(mockRequest)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles Distance Matrix API error status', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'REQUEST_DENIED', rows: [] })
      })

      const result = await fetchTravelTime(mockRequest)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles element with ZERO_RESULTS status', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          rows: [{ elements: [{ status: 'ZERO_RESULTS' }] }]
        })
      })

      const result = await fetchTravelTime(mockRequest)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles missing distance or duration in response', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          rows: [{ elements: [{ status: 'OK' }] }]
        })
      })

      const result = await fetchTravelTime(mockRequest)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles network errors', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchTravelTime(mockRequest)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching travel time from Google Maps:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('constructs correct API URL', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      await fetchTravelTime(mockRequest)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      const decodedUrl = decodeURIComponent(fetchCall)

      expect(fetchCall).toContain('https://maps.googleapis.com/maps/api/distancematrix/json')
      expect(decodedUrl).toContain('origins=40.7128,-74.006')
      expect(decodedUrl).toContain('destinations=40.7614,-73.9776')
      expect(decodedUrl).toContain('mode=driving')
      expect(decodedUrl).toContain('key=test-api-key')
    })
  })

  describe('secondsToMinutes', () => {
    it('converts exact minutes', () => {
      expect(secondsToMinutes(60)).toBe(1)
      expect(secondsToMinutes(300)).toBe(5)
      expect(secondsToMinutes(3600)).toBe(60)
    })

    it('rounds up partial minutes', () => {
      expect(secondsToMinutes(61)).toBe(2)
      expect(secondsToMinutes(90)).toBe(2)
      expect(secondsToMinutes(119)).toBe(2)
    })

    it('handles zero seconds', () => {
      expect(secondsToMinutes(0)).toBe(0)
    })

    it('handles one second', () => {
      expect(secondsToMinutes(1)).toBe(1)
    })

    it('handles large values', () => {
      expect(secondsToMinutes(86400)).toBe(1440) // 24 hours
    })
  })

  describe('formatTravelTimeText', () => {
    it('formats driving time with car emoji', () => {
      expect(formatTravelTimeText('25 mins', 'driving')).toBe('🚗 25 mins')
    })

    it('formats walking time with pedestrian emoji', () => {
      expect(formatTravelTimeText('15 mins', 'walking')).toBe('🚶 15 mins')
    })

    it('formats transit time with bus emoji', () => {
      expect(formatTravelTimeText('30 mins', 'transit')).toBe('🚌 30 mins')
    })

    it('formats bicycling time with bicycle emoji', () => {
      expect(formatTravelTimeText('12 mins', 'bicycling')).toBe('🚴 12 mins')
    })

    it('handles hour-based durations', () => {
      expect(formatTravelTimeText('1 hour 15 mins', 'driving')).toBe('🚗 1 hour 15 mins')
    })
  })
})
