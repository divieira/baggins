import {
  calculateFirstActivityStart,
  calculateActivityEnd,
  calculateNextActivityStart,
  getDefaultDuration,
  normalizeTimeString
} from '@/utils/timeline'

describe('Timeline Utils', () => {
  describe('normalizeTimeString', () => {
    it('should handle HH:mm format', () => {
      expect(normalizeTimeString('14:30')).toBe('14:30')
      expect(normalizeTimeString('09:00')).toBe('09:00')
      expect(normalizeTimeString('23:59')).toBe('23:59')
    })

    it('should handle HH:mm:ss format (PostgreSQL)', () => {
      expect(normalizeTimeString('14:30:00')).toBe('14:30')
      expect(normalizeTimeString('09:00:00')).toBe('09:00')
      expect(normalizeTimeString('23:59:59')).toBe('23:59')
    })

    it('should handle null/undefined', () => {
      expect(normalizeTimeString(null)).toBe('09:00')
      expect(normalizeTimeString(undefined)).toBe('09:00')
      expect(normalizeTimeString('')).toBe('09:00')
    })

    it('should handle invalid time strings', () => {
      expect(normalizeTimeString('invalid')).toBe('09:00')
      expect(normalizeTimeString('25:00:00')).toBe('09:00')
      expect(normalizeTimeString('abc:def')).toBe('09:00')
    })

    it('should extract time from timestamps', () => {
      expect(normalizeTimeString('2024-01-15T14:30:00Z')).toBe('14:30')
      expect(normalizeTimeString('2024-01-15 14:30:00')).toBe('14:30')
    })
  })

  describe('calculateFirstActivityStart', () => {
    it('should calculate start time with flight arrival', () => {
      // Flight arrives at 14:30, add 90 min buffer = 16:00
      const result = calculateFirstActivityStart('14:30:00', '15:00')
      expect(result).toBe('16:00')
    })

    it('should use hotel check-in if flight arrives early', () => {
      // Flight arrives at 10:00, add 90 min = 11:30, before check-in
      // Use check-in (15:00) + 30 min = 15:30
      const result = calculateFirstActivityStart('10:00:00', '15:00')
      expect(result).toBe('15:30')
    })

    it('should handle no flight', () => {
      // No flight, use check-in + 30 min
      const result = calculateFirstActivityStart(null, '15:00')
      expect(result).toBe('15:30')
    })

    it('should handle late flight arrival', () => {
      // Flight arrives at 20:00, add 90 min = 21:30
      const result = calculateFirstActivityStart('20:00:00', '15:00')
      expect(result).toBe('21:30')
    })

    it('should handle null hotel check-in time', () => {
      const result = calculateFirstActivityStart('14:30:00', null)
      expect(result).toBe('16:00') // Should still calculate with flight
    })
  })

  describe('calculateActivityEnd', () => {
    it('should add duration to start time', () => {
      expect(calculateActivityEnd('14:30', 120)).toBe('16:30')
      expect(calculateActivityEnd('09:00', 90)).toBe('10:30')
      expect(calculateActivityEnd('23:00', 30)).toBe('23:30')
    })

    it('should handle crossing midnight', () => {
      expect(calculateActivityEnd('23:30', 60)).toBe('00:30')
    })

    it('should handle HH:mm:ss format', () => {
      expect(calculateActivityEnd('14:30:00', 120)).toBe('16:30')
    })

    it('should handle invalid time gracefully', () => {
      // Invalid time defaults to 09:00, plus 120 min = 11:00
      expect(calculateActivityEnd('invalid', 120)).toBe('11:00')
    })
  })

  describe('calculateNextActivityStart', () => {
    it('should add travel time to previous end', () => {
      expect(calculateNextActivityStart('14:30', 15)).toBe('14:45')
      expect(calculateNextActivityStart('16:00', 30)).toBe('16:30')
    })

    it('should handle HH:mm:ss format', () => {
      expect(calculateNextActivityStart('14:30:00', 15)).toBe('14:45')
    })

    it('should handle crossing midnight', () => {
      expect(calculateNextActivityStart('23:50', 20)).toBe('00:10')
    })

    it('should handle zero travel time', () => {
      expect(calculateNextActivityStart('14:30', 0)).toBe('14:30')
    })
  })

  describe('getDefaultDuration', () => {
    it('should return 90 minutes for restaurants', () => {
      expect(getDefaultDuration('restaurant')).toBe(90)
    })

    it('should return 120 minutes for activities', () => {
      expect(getDefaultDuration('activity')).toBe(120)
    })
  })
})
