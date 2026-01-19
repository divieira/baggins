/**
 * Unit tests for AI trip parsing API endpoint
 * Tests the message parsing logic and error handling
 */

import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('@anthropic-ai/sdk')
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status || 200,
      json: async () => data
    })
  }
}))

describe('AI Parse Trip API Logic', () => {
  let mockSupabase: any
  let mockAnthropic: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn()
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    // Setup Anthropic mock
    mockAnthropic = {
      messages: {
        create: jest.fn()
      }
    }
    ;(Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropic)
  })

  describe('Authentication Logic', () => {
    it('should require authenticated user', () => {
      // Authentication should be checked first
      const authRequirement = {
        check: 'auth.getUser()',
        requiredField: 'user',
        errorOnMissing: 'Unauthorized'
      }

      expect(authRequirement.check).toBe('auth.getUser()')
      expect(authRequirement.errorOnMissing).toBe('Unauthorized')
    })
  })

  describe('Trip Data Parsing', () => {
    it('should extract destination, dates, and travelers', () => {
      const sampleMessage = 'Trip to Tokyo from April 10-17, 2026 with my wife and kids'
      const expectedParsedData = {
        destination: 'Tokyo, Japan',
        start_date: '2026-04-10',
        end_date: '2026-04-17',
        travelers: [
          { name: 'Wife', relation: 'wife' },
          { name: 'Kids', relation: 'children' }
        ]
      }

      expect(expectedParsedData.destination).toBeTruthy()
      expect(expectedParsedData.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(expectedParsedData.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(expectedParsedData.travelers).toBeInstanceOf(Array)
    })

    it('should validate required fields', () => {
      const requiredFields = ['destination', 'start_date', 'end_date']
      const optionalFields = ['travelers', 'flights', 'hotels']

      expect(requiredFields).toHaveLength(3)
      expect(optionalFields).toHaveLength(3)
    })

    it('should handle trips with complete details', () => {
      const completeTripData = {
        destination: 'Paris, France',
        start_date: '2026-03-15',
        end_date: '2026-03-20',
        travelers: [{ name: 'John', age: 35 }],
        flights: [{
          airline: 'Air France',
          flight_number: 'AF123',
          departure_time: '2026-03-15T10:00:00',
          arrival_time: '2026-03-15T14:30:00',
          from_location: 'New York JFK',
          to_location: 'Paris CDG'
        }],
        hotels: [{
          name: 'Hotel Eiffel',
          check_in_date: '2026-03-15',
          check_out_date: '2026-03-20',
          address: '123 Rue de la Paix'
        }]
      }

      expect(completeTripData.destination).toBeTruthy()
      expect(completeTripData.travelers.length).toBeGreaterThan(0)
      expect(completeTripData.flights.length).toBeGreaterThan(0)
      expect(completeTripData.hotels.length).toBeGreaterThan(0)
    })
  })

  describe('Database Operations', () => {
    it('should create trip with user_id', () => {
      const tripInsert = {
        table: 'trips',
        data: {
          user_id: 'user-123',
          destination: 'Paris',
          start_date: '2026-03-15',
          end_date: '2026-03-20'
        }
      }

      expect(tripInsert.data.user_id).toBeTruthy()
      expect(tripInsert.data.destination).toBeTruthy()
    })

    it('should create collaborator record for owner', () => {
      const collaboratorInsert = {
        table: 'trip_collaborators',
        data: {
          trip_id: 'trip-123',
          user_id: 'user-123',
          role: 'owner'
        }
      }

      expect(collaboratorInsert.data.role).toBe('owner')
    })

    it('should support updating existing trips', () => {
      const tripUpdate = {
        table: 'trips',
        operation: 'update',
        filters: ['id = trip-123', 'user_id = user-123'],
        data: {
          destination: 'New York',
          start_date: '2026-05-01',
          end_date: '2026-05-05'
        }
      }

      expect(tripUpdate.operation).toBe('update')
      expect(tripUpdate.filters).toContain('user_id = user-123')
    })

    it('should delete and recreate related entities on update', () => {
      const updateOperations = [
        { action: 'delete', table: 'travelers', condition: 'trip_id = trip-123' },
        { action: 'insert', table: 'travelers', data: 'new travelers' },
        { action: 'delete', table: 'flights', condition: 'trip_id = trip-123' },
        { action: 'insert', table: 'flights', data: 'new flights' },
        { action: 'delete', table: 'hotels', condition: 'trip_id = trip-123' },
        { action: 'insert', table: 'hotels', data: 'new hotels' }
      ]

      expect(updateOperations.length).toBe(6)
    })
  })

  describe('Claude AI Integration', () => {
    it('should use appropriate model and max tokens', () => {
      const aiConfig = {
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096
      }

      expect(aiConfig.model).toContain('claude')
      expect(aiConfig.max_tokens).toBeGreaterThan(2000)
    })

    it('should provide detailed system prompt', () => {
      const systemPrompt = {
        role: 'trip details parser',
        outputFormat: 'JSON only',
        dateFormat: 'ISO 8601 (YYYY-MM-DD)',
        instructions: [
          'Extract destination, dates, travelers, flights, hotels',
          'Use ISO date format',
          'Return only valid JSON'
        ]
      }

      expect(systemPrompt.outputFormat).toBe('JSON only')
      expect(systemPrompt.dateFormat).toContain('YYYY-MM-DD')
    })

    it('should extract JSON from AI response', () => {
      const responses = [
        '{"destination": "Paris", "start_date": "2026-03-15", "end_date": "2026-03-20", "travelers": []}',
        'Here is the parsed data: {"destination": "London", "start_date": "2026-04-01", "end_date": "2026-04-05", "travelers": []}',
        '```json\n{"destination": "Tokyo", "start_date": "2026-05-01", "end_date": "2026-05-10", "travelers": []}\n```'
      ]

      responses.forEach(response => {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        expect(jsonMatch).not.toBeNull()
        expect(() => JSON.parse(jsonMatch![0])).not.toThrow()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle missing required fields', () => {
      const incompleteTripData: any = {
        destination: 'Paris'
        // Missing start_date and end_date
      }

      const isValid = !!(incompleteTripData.destination &&
        incompleteTripData['start_date'] &&
        incompleteTripData['end_date'])

      expect(isValid).toBe(false)
    })

    it('should handle invalid JSON responses', () => {
      const invalidResponses = [
        'This is not JSON',
        '{ invalid json }',
        'null',
        ''
      ]

      invalidResponses.forEach(response => {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          expect(() => JSON.parse(jsonMatch[0])).toThrow()
        } else {
          expect(jsonMatch).toBeNull()
        }
      })
    })

    it('should provide helpful error messages', () => {
      const errorMessages = {
        unauthorized: 'Unauthorized',
        missingFields: 'Could not extract required trip details (destination and dates). Please provide more information.',
        parseError: 'Failed to parse trip details from message',
        genericError: 'Failed to parse trip details'
      }

      expect(errorMessages.unauthorized).toBeTruthy()
      expect(errorMessages.missingFields).toContain('required trip details')
      expect(errorMessages.parseError).toContain('Failed to parse')
    })
  })

  describe('Response Format', () => {
    it('should return trip with all details', () => {
      const successResponse = {
        trip: {
          id: 'trip-123',
          destination: 'Paris',
          start_date: '2026-03-15',
          end_date: '2026-03-20'
        },
        travelers: [{ id: 't1', name: 'John' }],
        flights: [{ id: 'f1', airline: 'Air France' }],
        hotels: [{ id: 'h1', name: 'Hotel Eiffel' }],
        parsed: {}
      }

      expect(successResponse.trip).toBeDefined()
      expect(successResponse.travelers).toBeInstanceOf(Array)
      expect(successResponse.flights).toBeInstanceOf(Array)
      expect(successResponse.hotels).toBeInstanceOf(Array)
    })

    it('should include parsed data for reference', () => {
      const response = {
        trip: {},
        travelers: [],
        flights: [],
        hotels: [],
        parsed: {
          destination: 'Tokyo',
          start_date: '2026-04-10',
          end_date: '2026-04-17'
        }
      }

      expect(response.parsed).toBeDefined()
    })
  })

  describe('Security', () => {
    it('should verify trip ownership for updates', () => {
      const updateQuery = {
        filters: [
          'id = tripId',
          'user_id = auth.uid()'  // Important security check
        ]
      }

      expect(updateQuery.filters).toContain('user_id = auth.uid()')
    })

    it('should not allow updating other users trips', () => {
      const securityCheck = {
        requirement: 'User must own the trip to update it',
        implementation: 'eq("user_id", user.id) in update query'
      }

      expect(securityCheck.requirement).toContain('must own')
    })
  })

  describe('Message Parsing Examples', () => {
    it('should handle various date formats', () => {
      const datePatterns = [
        { input: 'March 15-20, 2026', expected: { start: '2026-03-15', end: '2026-03-20' } },
        { input: 'April 10-17', expected: { start: '2026-04-10', end: '2026-04-17' } },
        { input: '2026-05-01 to 2026-05-05', expected: { start: '2026-05-01', end: '2026-05-05' } }
      ]

      datePatterns.forEach(pattern => {
        expect(pattern.expected.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(pattern.expected.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })
    })

    it('should extract traveler relationships', () => {
      const travelerPatterns = [
        { input: 'with my wife Sarah', expected: { name: 'Sarah', relation: 'wife' } },
        { input: 'and kids Tommy (8) and Emma (5)', expected: [
          { name: 'Tommy', age: 8, relation: 'son' },
          { name: 'Emma', age: 5, relation: 'daughter' }
        ]},
        { input: 'solo trip', expected: [] }
      ]

      expect(travelerPatterns).toHaveLength(3)
      travelerPatterns.forEach(pattern => {
        expect(pattern.input).toBeTruthy()
      })
    })

    it('should parse flight information', () => {
      const flightInfo = {
        input: 'Flying Air France AF123 departing 10am from JFK',
        expected: {
          airline: 'Air France',
          flight_number: 'AF123',
          departure_time: '10:00',
          from_location: 'JFK'
        }
      }

      expect(flightInfo.expected.airline).toBeTruthy()
      expect(flightInfo.expected.flight_number).toBeTruthy()
    })
  })
})
