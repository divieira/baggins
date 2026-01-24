import { format, parse, addMinutes } from 'date-fns'

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
 * Calculate the first activity start time based on flight arrival or default
 */
export function calculateFirstActivityStart(
  flightArrivalTime: string | null,
  hotelCheckinTime: string | null = '15:00'
): string {
  const defaultCheckinTime = hotelCheckinTime || '15:00'

  if (flightArrivalTime) {
    // Add buffer for customs, baggage, and transport to hotel (90 minutes)
    const arrivalDate = parse(flightArrivalTime, 'HH:mm', new Date())
    const afterBufferDate = addMinutes(arrivalDate, 90)

    // If arrival + buffer is before hotel check-in, use hotel check-in time
    // Otherwise start activities after the buffer
    const bufferTime = format(afterBufferDate, 'HH:mm')

    if (bufferTime < defaultCheckinTime) {
      // Add 30 minutes after check-in for settling in
      const checkinDate = parse(defaultCheckinTime, 'HH:mm', new Date())
      return format(addMinutes(checkinDate, 30), 'HH:mm')
    }

    return bufferTime
  }

  // No flight, assume starting after check-in
  const checkinDate = parse(defaultCheckinTime, 'HH:mm', new Date())
  return format(addMinutes(checkinDate, 30), 'HH:mm')
}

/**
 * Calculate end time for an activity based on start time and duration
 */
export function calculateActivityEnd(startTime: string, durationMinutes: number): string {
  const startDate = parse(startTime, 'HH:mm', new Date())
  const endDate = addMinutes(startDate, durationMinutes)
  return format(endDate, 'HH:mm')
}

/**
 * Calculate start time for next activity based on previous end time and travel time
 */
export function calculateNextActivityStart(
  previousEndTime: string,
  travelTimeMinutes: number
): string {
  const prevEndDate = parse(previousEndTime, 'HH:mm', new Date())
  const nextStartDate = addMinutes(prevEndDate, travelTimeMinutes)
  return format(nextStartDate, 'HH:mm')
}

/**
 * Get default duration for activity type if not specified
 */
export function getDefaultDuration(type: 'activity' | 'restaurant'): number {
  return type === 'restaurant' ? 90 : 120 // 90 min for meals, 120 min for attractions
}
