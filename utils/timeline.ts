import { format, parse, addMinutes, isValid } from 'date-fns'

export interface TimelineEntry {
  id: string
  type: 'flight' | 'hotel_checkin' | 'activity' | 'restaurant'
  startTime: string // HH:mm format
  endTime: string   // HH:mm format
  title: string
  subtitle?: string
  travelTimeFromPrevious?: number // minutes
  data?: any // Original flight/hotel/attraction/restaurant data
}

/**
 * Parse time string that may be in HH:mm or HH:mm:ss format
 */
function parseTimeString(timeString: string): Date {
  // Try HH:mm:ss format first (from PostgreSQL time fields)
  let parsed = parse(timeString, 'HH:mm:ss', new Date())
  if (isValid(parsed)) return parsed

  // Try HH:mm format
  parsed = parse(timeString, 'HH:mm', new Date())
  if (isValid(parsed)) return parsed

  // Fallback: try to extract just the time part if it's a full timestamp
  const timeMatch = timeString.match(/(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (timeMatch) {
    const [, hours, minutes, seconds] = timeMatch
    const timeOnly = seconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`
    parsed = parse(timeOnly, seconds ? 'HH:mm:ss' : 'HH:mm', new Date())
    if (isValid(parsed)) return parsed
  }

  // Invalid time - return a default
  console.warn(`Invalid time format: ${timeString}, defaulting to 09:00`)
  return parse('09:00', 'HH:mm', new Date())
}

/**
 * Calculate the first activity start time based on flight arrival or default
 */
export function calculateFirstActivityStart(
  flightArrivalTime: string | null,
  hotelCheckinTime: string | null = '15:00'
): string {
  const defaultCheckinTime = hotelCheckinTime || '15:00'

  if (flightArrivalTime) {
    try {
      // Add buffer for customs, baggage, and transport to hotel (90 minutes)
      const arrivalDate = parseTimeString(flightArrivalTime)
      const afterBufferDate = addMinutes(arrivalDate, 90)

      // If arrival + buffer is before hotel check-in, use hotel check-in time
      // Otherwise start activities after the buffer
      const bufferTime = format(afterBufferDate, 'HH:mm')

      if (bufferTime < defaultCheckinTime) {
        // Add 30 minutes after check-in for settling in
        const checkinDate = parseTimeString(defaultCheckinTime)
        return format(addMinutes(checkinDate, 30), 'HH:mm')
      }

      return bufferTime
    } catch (error) {
      console.error('Error calculating first activity start:', error)
      // Fallback to check-in time
    }
  }

  // No flight, assume starting after check-in
  const checkinDate = parseTimeString(defaultCheckinTime)
  return format(addMinutes(checkinDate, 30), 'HH:mm')
}

/**
 * Calculate end time for an activity based on start time and duration
 */
export function calculateActivityEnd(startTime: string, durationMinutes: number): string {
  try {
    const startDate = parseTimeString(startTime)
    const endDate = addMinutes(startDate, durationMinutes)
    return format(endDate, 'HH:mm')
  } catch (error) {
    console.error('Error calculating activity end:', error)
    return startTime // Fallback to start time
  }
}

/**
 * Calculate start time for next activity based on previous end time and travel time
 */
export function calculateNextActivityStart(
  previousEndTime: string,
  travelTimeMinutes: number
): string {
  try {
    const prevEndDate = parseTimeString(previousEndTime)
    const nextStartDate = addMinutes(prevEndDate, travelTimeMinutes)
    return format(nextStartDate, 'HH:mm')
  } catch (error) {
    console.error('Error calculating next activity start:', error)
    return previousEndTime // Fallback to previous end time
  }
}

/**
 * Get default duration for activity type if not specified
 */
export function getDefaultDuration(type: 'activity' | 'restaurant'): number {
  return type === 'restaurant' ? 90 : 120 // 90 min for meals, 120 min for attractions
}

/**
 * Normalize a time string to HH:mm format
 */
export function normalizeTimeString(timeString: string | null | undefined): string {
  if (!timeString) return '09:00'

  try {
    const parsed = parseTimeString(timeString)
    return format(parsed, 'HH:mm')
  } catch (error) {
    console.error('Error normalizing time string:', timeString, error)
    return '09:00'
  }
}
