import { format, parse, isWithinInterval } from 'date-fns'

/**
 * Check if a time is within opening hours
 */
export function isOpenAt(
  time: string,
  openingTime: string | null,
  closingTime: string | null
): boolean {
  if (!openingTime || !closingTime) return true // Assume open if no hours specified

  const timeDate = parse(time, 'HH:mm', new Date())
  const openDate = parse(openingTime, 'HH:mm', new Date())
  const closeDate = parse(closingTime, 'HH:mm', new Date())

  return isWithinInterval(timeDate, { start: openDate, end: closeDate })
}

/**
 * Format time for display
 */
export function formatTime(time: string): string {
  const date = parse(time, 'HH:mm:ss', new Date())
  return format(date, 'h:mm a')
}

/**
 * Get default time blocks for a day
 */
export interface DefaultTimeBlock {
  type: 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening'
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
    {
      type: 'evening',
      startTime: '20:00',
      endTime: '23:00',
      label: 'Evening Activity',
    },
  ]
}
