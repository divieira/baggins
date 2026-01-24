import { format, parse, isWithinInterval, isValid } from 'date-fns'

/**
 * Parse time string flexibly (handles HH:mm or HH:mm:ss)
 */
function parseTimeFlexible(timeString: string): Date {
  // Try HH:mm:ss first
  let date = parse(timeString, 'HH:mm:ss', new Date())
  if (isValid(date)) return date

  // Try HH:mm
  date = parse(timeString, 'HH:mm', new Date())
  if (isValid(date)) return date

  // Fallback
  return parse('00:00', 'HH:mm', new Date())
}

/**
 * Check if a time is within opening hours
 */
export function isOpenAt(
  time: string,
  openingTime: string | null,
  closingTime: string | null
): boolean {
  if (!openingTime || !closingTime) return true // Assume open if no hours specified

  const timeDate = parseTimeFlexible(time)
  const openDate = parseTimeFlexible(openingTime)
  const closeDate = parseTimeFlexible(closingTime)

  return isWithinInterval(timeDate, { start: openDate, end: closeDate })
}

/**
 * Format time for display
 * Handles both HH:mm and HH:mm:ss formats
 */
export function formatTime(time: string | null | undefined): string {
  if (!time || typeof time !== 'string') return ''

  try {
    // Try HH:mm:ss format first (from database)
    let date = parse(time, 'HH:mm:ss', new Date())
    if (isValid(date)) {
      return format(date, 'h:mm a')
    }

    // Try HH:mm format (normalized)
    date = parse(time, 'HH:mm', new Date())
    if (isValid(date)) {
      return format(date, 'h:mm a')
    }

    // Try to extract time from timestamp
    const timeMatch = time.match(/(\d{2}):(\d{2})(?::(\d{2}))?/)
    if (timeMatch) {
      const [, hours, minutes, seconds] = timeMatch
      const timeOnly = seconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`
      date = parse(timeOnly, seconds ? 'HH:mm:ss' : 'HH:mm', new Date())
      if (isValid(date)) {
        return format(date, 'h:mm a')
      }
    }

    // Fallback: return original string
    console.warn(`Unable to format time: ${time}`)
    return time
  } catch (error) {
    console.error(`Error formatting time: ${time}`, error)
    return ''
  }
}

/**
 * Get default time blocks for a day
 */
export interface DefaultTimeBlock {
  type: 'morning' | 'lunch' | 'afternoon' | 'dinner'
  startTime: string
  endTime: string
  label: string
}

export function getDefaultTimeBlocks(): DefaultTimeBlock[] {
  return [
    {
      type: 'morning',
      startTime: '09:00',
      endTime: '12:00',
      label: 'Morning Activity',
    },
    {
      type: 'lunch',
      startTime: '12:00',
      endTime: '13:30',
      label: 'Lunch',
    },
    {
      type: 'afternoon',
      startTime: '13:30',
      endTime: '17:00',
      label: 'Afternoon Activity',
    },
    {
      type: 'dinner',
      startTime: '18:00',
      endTime: '20:00',
      label: 'Dinner',
    },
  ]
}
