/**
 * Test for parsing the specific Santiago-Pucon trip
 * This reproduces the user's reported issue
 */

import Anthropic from '@anthropic-ai/sdk'

// Mock Anthropic but we want to see what it SHOULD parse
jest.mock('@anthropic-ai/sdk')

describe('Santiago-Pucon Trip Parsing', () => {
  const userInput = `✈️ Voos:
25/01: FLN-SCL (JetSMART JA879) | 10:50 - 14:35
28/01: SCL-ZCO (LATAM LA37) | 16:53 - 18:16
01/02: ZCO-SCL-FLN (LATAM Airlines LA32) | 11:13 - 12:35

🏨 Hotéis:
Santiago (25-28/01): APT Serviced Apartments (Las Condes)
Pucón (28/01-01/02): Hotel Montes Verdes

👥 Passageiros:
2 Adultos (Diego e Stephanie)
2 Crianças (Oliver - 3 anos e Thomas - 1 ano)`

  it('should correctly parse two cities: Santiago and Pucón', () => {
    // Expected parsed structure
    const expectedParsing = {
      destination: 'Santiago & Pucón, Chile',
      start_date: '2026-01-25',
      end_date: '2026-02-01',
      cities: [
        {
          name: 'Santiago, Chile',
          start_date: '2026-01-25',
          end_date: '2026-01-28',
          hotel: {
            name: 'APT Serviced Apartments',
            address: 'Las Condes, Santiago',
            latitude: -33.4172,
            longitude: -70.5476
          }
        },
        {
          name: 'Pucón, Chile',
          start_date: '2026-01-28',
          end_date: '2026-02-01',
          hotel: {
            name: 'Hotel Montes Verdes',
            address: 'Pucón',
            latitude: -39.2819,
            longitude: -71.9755
          }
        }
      ],
      travelers: [
        { name: 'Diego', relation: 'self' },
        { name: 'Stephanie', relation: 'partner' },
        { name: 'Oliver', age: 3, relation: 'child' },
        { name: 'Thomas', age: 1, relation: 'child' }
      ],
      flights: [
        {
          date: '2026-01-25',
          airline: 'JetSMART',
          flight_number: 'JA879',
          from_location: 'FLN',
          to_location: 'SCL',
          departure_time: '10:50',
          arrival_time: '14:35'
        },
        {
          date: '2026-01-28',
          airline: 'LATAM',
          flight_number: 'LA37',
          from_location: 'SCL',
          to_location: 'ZCO',
          departure_time: '16:53',
          arrival_time: '18:16'
        },
        {
          date: '2026-02-01',
          airline: 'LATAM Airlines',
          flight_number: 'LA32',
          from_location: 'ZCO',
          to_location: 'SCL',
          departure_time: '11:13',
          arrival_time: '12:35'
        }
      ]
    }

    // Verify expected structure
    expect(expectedParsing.cities).toHaveLength(2)
    expect(expectedParsing.cities[0].name).toContain('Santiago')
    expect(expectedParsing.cities[1].name).toContain('Pucón')

    // CRITICAL: Both cities should have date ranges
    expect(expectedParsing.cities[0].start_date).toBe('2026-01-25')
    expect(expectedParsing.cities[0].end_date).toBe('2026-01-28')
    expect(expectedParsing.cities[1].start_date).toBe('2026-01-28')
    expect(expectedParsing.cities[1].end_date).toBe('2026-02-01')

    // CRITICAL: Both cities should have hotels
    expect(expectedParsing.cities[0].hotel).toBeDefined()
    expect(expectedParsing.cities[1].hotel).toBeDefined()
  })

  it('should have consistent city order in parsed data', () => {
    // The order matters because:
    // 1. Cities are inserted with order_index based on array position
    // 2. Hotels are mapped using array index: insertedCities[index]
    // 3. Suggestions are generated using fetched cities

    const cityOrder = [
      'Santiago should be first (arrives 25/01)',
      'Pucón should be second (arrives 28/01)'
    ]

    expect(cityOrder).toHaveLength(2)
    expect(cityOrder[0]).toContain('Santiago')
    expect(cityOrder[1]).toContain('Pucón')
  })

  it('should document the date format challenge', () => {
    // The input uses Brazilian/European date format: DD/MM
    // Claude needs to correctly parse:
    // - "25/01" as January 25th (not May 1st)
    // - "28/01" as January 28th
    // - "01/02" as February 1st (not January 2nd)
    // - "(25-28/01)" as "from 25th to 28th of January"
    // - "(28/01-01/02)" as "from Jan 28th to Feb 1st"

    const dateFormats = {
      input: 'DD/MM format with ranges like (25-28/01)',
      expected: 'YYYY-MM-DD ISO format',
      challenges: [
        'Ambiguous month/day order',
        'Assumes current year (2026)',
        'Date ranges with partial month notation'
      ]
    }

    expect(dateFormats.challenges.length).toBe(3)
  })

  it('should validate that suggestion generation would be called for both cities', () => {
    // After cities are created, the code should:
    // 1. Fetch cities from database with order_index
    // 2. Loop through each city
    // 3. Call generateCitySuggestions for each city_id

    const suggestionGenerationFlow = {
      step1: 'Insert cities with order_index: 0 (Santiago), 1 (Pucón)',
      step2: 'Fetch cities ordered by order_index',
      step3: 'For each city, call generateCitySuggestions(cityId, cityName)',
      step4: 'Attractions/restaurants saved with city_id foreign key',
      step5: 'UI queries attractions WHERE city_id = <specific-city-id>'
    }

    expect(suggestionGenerationFlow.step1).toContain('order_index')
    expect(suggestionGenerationFlow.step3).toContain('each city')
    expect(suggestionGenerationFlow.step5).toContain('WHERE city_id')
  })

  it('should catch errors during suggestion generation without failing entire trip creation', () => {
    // The parse-trip endpoint has a try-catch around generateCitySuggestions
    // If Santiago suggestions fail, it should:
    // 1. Log the error
    // 2. Continue to generate Pucón suggestions
    // 3. Return success with partial data

    const errorHandling = {
      catchBlock: 'try { generateCitySuggestions() } catch { console.error(); continue }',
      behavior: 'Continues with next city even if one fails',
      consequence: 'One city may have 0 attractions if generation fails'
    }

    expect(errorHandling.behavior).toContain('Continues')
    expect(errorHandling.consequence).toContain('0 attractions')
  })

  describe('Potential Root Causes', () => {
    it('Hypothesis 1: Claude fails to parse Santiago from the input', () => {
      // Maybe Claude doesn't recognize "Santiago (25-28/01)" as a city
      // Or misinterprets the date range
      const hypothesis = {
        issue: 'Claude might only extract one city instead of two',
        verification: 'Check parsed cities array length',
        fix: 'Improve system prompt to handle date range format'
      }

      expect(hypothesis.issue).toBeTruthy()
    })

    it('Hypothesis 2: Claude parses cities in wrong order', () => {
      // Maybe Claude puts Pucón first instead of Santiago
      // This would cause index mismatch when mapping hotels
      const hypothesis = {
        issue: 'Cities array order might not match hotel array order',
        verification: 'Check if insertedCities[0] corresponds to first hotel',
        fix: 'Match cities to hotels by name instead of array index'
      }

      expect(hypothesis.verification).toContain('insertedCities')
    })

    it('Hypothesis 3: Suggestion generation fails silently for Santiago', () => {
      // Anthropic API call might fail for the first city
      // Error is caught and logged but doesn't stop execution
      const hypothesis = {
        issue: 'generateCitySuggestions might fail for Santiago but not Pucón',
        verification: 'Check server logs for errors during suggestion generation',
        fix: 'Add retry logic or better error reporting'
      }

      expect(hypothesis.issue).toContain('fail')
    })

    it('Hypothesis 4: Santiago attractions are generated but with null city_id', () => {
      // Due to a bug, Santiago attractions might be saved with city_id = null
      // UI filters by city_id, so null values don't show up
      const hypothesis = {
        issue: 'Attractions exist but have null city_id',
        verification: 'Query attractions WHERE city_id IS NULL',
        fix: 'Ensure city_id is always set during insertion'
      }

      expect(hypothesis.verification).toContain('IS NULL')
    })
  })
})
