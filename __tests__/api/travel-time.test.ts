/**
 * Tests for travel time API route
 */

import { POST } from '@/app/api/travel-time/route'
import { fetchTravelTime } from '@/utils/google-maps'
import type { TravelTimeResult } from '@/utils/google-maps'

// Mock Next.js server response
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status || 200,
      json: async () => data
    })
  }
}))

// Mock the google-maps utility
jest.mock('@/utils/google-maps', () => ({
  fetchTravelTime: jest.fn()
}))

describe('Travel Time API Route', () => {
  const mockTravelTimeResult: TravelTimeResult = {
    distanceMeters: 8046,
    distanceText: '5.0 mi',
    durationSeconds: 1500,
    durationText: '25 mins',
    mode: 'driving'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns travel time for valid request', async () => {
    (fetchTravelTime as jest.Mock).mockResolvedValueOnce(mockTravelTimeResult)

    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 },
        destination: { latitude: 40.7614, longitude: -73.9776 },
        mode: 'driving'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockTravelTimeResult)
    expect(fetchTravelTime).toHaveBeenCalledWith({
      origin: { latitude: 40.7128, longitude: -74.0060 },
      destination: { latitude: 40.7614, longitude: -73.9776 },
      mode: 'driving'
    })
  })

  it('uses default driving mode when mode not specified', async () => {
    (fetchTravelTime as jest.Mock).mockResolvedValueOnce(mockTravelTimeResult)

    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 },
        destination: { latitude: 40.7614, longitude: -73.9776 }
      })
    })

    await POST(request)

    expect(fetchTravelTime).toHaveBeenCalledWith({
      origin: expect.any(Object),
      destination: expect.any(Object),
      mode: 'driving'
    })
  })

  it('returns 400 for missing origin', async () => {
    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        destination: { latitude: 40.7614, longitude: -73.9776 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid origin coordinates')
    expect(fetchTravelTime).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid origin latitude', async () => {
    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { longitude: -74.0060 },
        destination: { latitude: 40.7614, longitude: -73.9776 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid origin coordinates')
    expect(fetchTravelTime).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid origin longitude', async () => {
    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128 },
        destination: { latitude: 40.7614, longitude: -73.9776 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid origin coordinates')
    expect(fetchTravelTime).not.toHaveBeenCalled()
  })

  it('returns 400 for missing destination', async () => {
    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid destination coordinates')
    expect(fetchTravelTime).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid destination latitude', async () => {
    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 },
        destination: { longitude: -73.9776 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid destination coordinates')
    expect(fetchTravelTime).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid destination longitude', async () => {
    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 },
        destination: { latitude: 40.7614 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid destination coordinates')
    expect(fetchTravelTime).not.toHaveBeenCalled()
  })

  it('returns 503 when fetchTravelTime returns null', async () => {
    (fetchTravelTime as jest.Mock).mockResolvedValueOnce(null)

    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 },
        destination: { latitude: 40.7614, longitude: -73.9776 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toBe('Unable to fetch travel time. Please check API configuration.')
  })

  it('returns 500 for unexpected errors', async () => {
    (fetchTravelTime as jest.Mock).mockRejectedValueOnce(new Error('Unexpected error'))

    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 },
        destination: { latitude: 40.7614, longitude: -73.9776 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })

  it('supports walking mode', async () => {
    (fetchTravelTime as jest.Mock).mockResolvedValueOnce({
      ...mockTravelTimeResult,
      mode: 'walking'
    })

    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 },
        destination: { latitude: 40.7614, longitude: -73.9776 },
        mode: 'walking'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.mode).toBe('walking')
    expect(fetchTravelTime).toHaveBeenCalledWith({
      origin: expect.any(Object),
      destination: expect.any(Object),
      mode: 'walking'
    })
  })

  it('supports transit mode', async () => {
    (fetchTravelTime as jest.Mock).mockResolvedValueOnce({
      ...mockTravelTimeResult,
      mode: 'transit'
    })

    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 },
        destination: { latitude: 40.7614, longitude: -73.9776 },
        mode: 'transit'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.mode).toBe('transit')
  })

  it('supports bicycling mode', async () => {
    (fetchTravelTime as jest.Mock).mockResolvedValueOnce({
      ...mockTravelTimeResult,
      mode: 'bicycling'
    })

    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 40.7128, longitude: -74.0060 },
        destination: { latitude: 40.7614, longitude: -73.9776 },
        mode: 'bicycling'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.mode).toBe('bicycling')
  })

  it('handles zero coordinates', async () => {
    (fetchTravelTime as jest.Mock).mockResolvedValueOnce(mockTravelTimeResult)

    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: 0, longitude: 0 },
        destination: { latitude: 40.7614, longitude: -73.9776 }
      })
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(fetchTravelTime).toHaveBeenCalledWith({
      origin: { latitude: 0, longitude: 0 },
      destination: expect.any(Object),
      mode: 'driving'
    })
  })

  it('handles negative coordinates', async () => {
    (fetchTravelTime as jest.Mock).mockResolvedValueOnce(mockTravelTimeResult)

    const request = new Request('http://localhost:3000/api/travel-time', {
      method: 'POST',
      body: JSON.stringify({
        origin: { latitude: -33.8688, longitude: 151.2093 },
        destination: { latitude: -33.8568, longitude: 151.2153 }
      })
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(fetchTravelTime).toHaveBeenCalledWith({
      origin: { latitude: -33.8688, longitude: 151.2093 },
      destination: { latitude: -33.8568, longitude: 151.2153 },
      mode: 'driving'
    })
  })
})
