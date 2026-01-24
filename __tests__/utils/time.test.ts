import { formatTime, isOpenAt } from '@/utils/time'

describe('Time Utils', () => {
  describe('formatTime', () => {
    it('should handle HH:mm:ss format (PostgreSQL)', () => {
      expect(formatTime('14:30:00')).toBe('2:30 PM')
      expect(formatTime('09:00:00')).toBe('9:00 AM')
      expect(formatTime('23:59:59')).toBe('11:59 PM')
      expect(formatTime('00:00:00')).toBe('12:00 AM')
    })

    it('should handle HH:mm format (normalized)', () => {
      expect(formatTime('14:30')).toBe('2:30 PM')
      expect(formatTime('09:00')).toBe('9:00 AM')
      expect(formatTime('23:59')).toBe('11:59 PM')
      expect(formatTime('00:00')).toBe('12:00 AM')
    })

    it('should handle noon and midnight', () => {
      expect(formatTime('12:00')).toBe('12:00 PM')
      expect(formatTime('12:00:00')).toBe('12:00 PM')
      expect(formatTime('00:00')).toBe('12:00 AM')
      expect(formatTime('00:00:00')).toBe('12:00 AM')
    })

    it('should handle empty/null values', () => {
      expect(formatTime('')).toBe('')
    })

    it('should extract time from timestamps', () => {
      expect(formatTime('2024-01-15T14:30:00Z')).toBe('2:30 PM')
      expect(formatTime('2024-01-15 14:30:00')).toBe('2:30 PM')
    })

    it('should return original string for invalid input', () => {
      const result = formatTime('invalid')
      expect(result).toBe('invalid')
    })
  })

  describe('isOpenAt', () => {
    it('should return true if within opening hours (HH:mm:ss)', () => {
      expect(isOpenAt('10:00:00', '09:00:00', '17:00:00')).toBe(true)
      expect(isOpenAt('14:30:00', '09:00:00', '17:00:00')).toBe(true)
    })

    it('should return true if within opening hours (HH:mm)', () => {
      expect(isOpenAt('10:00', '09:00', '17:00')).toBe(true)
      expect(isOpenAt('14:30', '09:00', '17:00')).toBe(true)
    })

    it('should return false if before opening', () => {
      expect(isOpenAt('08:00:00', '09:00:00', '17:00:00')).toBe(false)
      expect(isOpenAt('08:00', '09:00', '17:00')).toBe(false)
    })

    it('should return false if after closing', () => {
      expect(isOpenAt('18:00:00', '09:00:00', '17:00:00')).toBe(false)
      expect(isOpenAt('18:00', '09:00', '17:00')).toBe(false)
    })

    it('should return true if no opening hours specified', () => {
      expect(isOpenAt('14:00', null, null)).toBe(true)
      expect(isOpenAt('14:00', null, '17:00')).toBe(true)
      expect(isOpenAt('14:00', '09:00', null)).toBe(true)
    })

    it('should handle mixed formats', () => {
      expect(isOpenAt('10:00', '09:00:00', '17:00')).toBe(true)
      expect(isOpenAt('10:00:00', '09:00', '17:00:00')).toBe(true)
    })

    it('should handle edge cases (opening/closing time)', () => {
      expect(isOpenAt('09:00', '09:00', '17:00')).toBe(true)
      expect(isOpenAt('17:00', '09:00', '17:00')).toBe(true)
    })
  })
})
