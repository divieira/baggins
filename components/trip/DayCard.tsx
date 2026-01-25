'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Flight, Hotel, TimeBlock, Attraction, Restaurant } from '@/types'
import { formatTime } from '@/utils/time'
import {
  calculateFirstActivityStart,
  calculateActivityEnd,
  calculateNextActivityStart,
  getDefaultDuration,
  normalizeTimeString,
  type TimelineEntry
} from '@/utils/timeline'
import { calculateDistance, estimateTravelTime } from '@/utils/distance'
import TimeBlockCard from './TimeBlockCard'

interface Props {
  date: Date
  flights: Flight[]
  hotel: Hotel | null | undefined
  blocks: TimeBlock[]
  tripId: string
  onBlockUpdate: (blockId: string, updates: Partial<TimeBlock>) => Promise<void>
  isOffline?: boolean
}

export default function DayCard({ date, flights, hotel, blocks, tripId, onBlockUpdate, isOffline = false }: Props) {
  const [attractions, setAttractions] = useState<Attraction[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const supabase = createClient()

  // Get city_id from blocks or hotel (all blocks on same day should have same city_id)
  const cityId = blocks[0]?.city_id || hotel?.city_id

  useEffect(() => {
    loadSuggestions()
  }, [tripId, cityId])

  const loadSuggestions = async () => {
    console.log('[DayCard] loadSuggestions called, cityId:', cityId, 'tripId:', tripId)
    // Query by city_id if available, otherwise fall back to trip_id
    const [{ data: attractionsData, error: attrError }, { data: restaurantsData, error: restError }] = await Promise.all([
      cityId
        ? supabase.from('attractions').select('*').eq('city_id', cityId)
        : supabase.from('attractions').select('*').eq('trip_id', tripId),
      cityId
        ? supabase.from('restaurants').select('*').eq('city_id', cityId)
        : supabase.from('restaurants').select('*').eq('trip_id', tripId)
    ])

    if (attrError) console.error('[DayCard] Error loading attractions:', attrError)
    if (restError) console.error('[DayCard] Error loading restaurants:', restError)

    console.log('[DayCard] Loaded:', attractionsData?.length || 0, 'attractions,', restaurantsData?.length || 0, 'restaurants')

    if (attractionsData) setAttractions(attractionsData)
    if (restaurantsData) setRestaurants(restaurantsData)
  }

  const getAvailableAttractions = (block: TimeBlock) => {
    // Filter attractions that are already selected in other blocks
    const selectedIds = blocks
      .filter(b => b.id !== block.id && b.selected_attraction_id)
      .map(b => b.selected_attraction_id)

    return attractions.filter(a => !selectedIds.includes(a.id))
  }

  const getAvailableRestaurants = (block: TimeBlock) => {
    // Filter restaurants that are already selected in other blocks
    const selectedIds = blocks
      .filter(b => b.id !== block.id && b.selected_restaurant_id)
      .map(b => b.selected_restaurant_id)

    return restaurants.filter(r => !selectedIds.includes(r.id))
  }

  // Build timeline with dynamic times
  const timeline = useMemo<TimelineEntry[]>(() => {
    console.log('[DayCard] Building timeline for date:', format(date, 'yyyy-MM-dd'))
    console.log('[DayCard] Blocks:', blocks.length, 'Attractions:', attractions.length, 'Restaurants:', restaurants.length)

    const entries: TimelineEntry[] = []

    // Add flights
    flights.forEach(flight => {
      entries.push({
        id: `flight-${flight.id}`,
        type: 'flight',
        startTime: normalizeTimeString(flight.departure_time),
        endTime: normalizeTimeString(flight.arrival_time),
        title: `${flight.airline} ${flight.flight_number}`,
        subtitle: `${flight.departure_airport} → ${flight.arrival_airport}`,
        data: flight
      })
    })

    // Add hotel info (check-in on arrival day, just info on other days)
    if (hotel) {
      try {
        const currentDate = new Date(date)
        const currentDateStr = format(currentDate, 'yyyy-MM-dd')

        // Check if this is check-in day
        const isCheckinDay = hotel.check_in_date === currentDateStr

        // Check if this is during the stay (between check-in and check-out)
        const isStayingHere = hotel.check_in_date && hotel.check_out_date &&
          currentDateStr >= hotel.check_in_date && currentDateStr < hotel.check_out_date

        if (isCheckinDay) {
          entries.push({
            id: `hotel-${hotel.id}`,
            type: 'hotel_checkin',
            startTime: '15:00', // Standard hotel check-in time
            endTime: '15:30',   // Allow 30 min for check-in
            title: `Check in at ${hotel.name}`,
            subtitle: hotel.address,
            data: hotel
          })
        } else if (isStayingHere) {
          // Show hotel as info on other days during stay
          entries.push({
            id: `hotel-${hotel.id}-info`,
            type: 'hotel_checkin', // Reuse same type for similar styling
            startTime: '00:00', // Show at top
            endTime: '00:00',
            title: `Staying at ${hotel.name}`,
            subtitle: hotel.address,
            data: hotel
          })
        }
      } catch (error) {
        console.error('Error parsing hotel dates:', error)
      }
    }

    // Sort by start time so far
    entries.sort((a, b) => a.startTime.localeCompare(b.startTime))

    // Calculate first activity start time
    const lastFlightArrival = flights.length > 0 ? normalizeTimeString(flights[flights.length - 1].arrival_time) : null
    let currentTime = calculateFirstActivityStart(lastFlightArrival, '15:00')

    // Add time blocks as activities with calculated times
    let prevSelectedItem: Attraction | Restaurant | null = null

    blocks.forEach((block, index) => {
      const prevBlock = index > 0 ? blocks[index - 1] : null

      // Get selected item
      let selectedItem: Attraction | Restaurant | null = null
      let activityType: 'activity' | 'restaurant' = 'activity'

      if (block.selected_attraction_id) {
        selectedItem = attractions.find(a => a.id === block.selected_attraction_id) || null
        if (!selectedItem) {
          console.warn('[DayCard] Block has selected_attraction_id but attraction not found:', block.selected_attraction_id)
        }
        activityType = 'activity'
      } else if (block.selected_restaurant_id) {
        selectedItem = restaurants.find(r => r.id === block.selected_restaurant_id) || null
        if (!selectedItem) {
          console.warn('[DayCard] Block has selected_restaurant_id but restaurant not found:', block.selected_restaurant_id)
        }
        activityType = 'restaurant'
      }

      if (selectedItem) {
        // Calculate travel time from previous location
        let travelTime = 0

        if (prevSelectedItem) {
          // Calculate distance between previous and current activity
          const distance = calculateDistance(
            prevSelectedItem.latitude,
            prevSelectedItem.longitude,
            selectedItem.latitude,
            selectedItem.longitude
          )
          travelTime = estimateTravelTime(distance)
        } else if (hotel && index === 0) {
          // First activity - calculate from hotel
          const distance = calculateDistance(
            hotel.latitude || 0,
            hotel.longitude || 0,
            selectedItem.latitude,
            selectedItem.longitude
          )
          travelTime = estimateTravelTime(distance)
        }

        // Add travel time to current time
        if (travelTime > 0) {
          currentTime = calculateNextActivityStart(currentTime, travelTime)
        }

        const duration = ('duration_minutes' in selectedItem ? selectedItem.duration_minutes : null) || getDefaultDuration(activityType)
        const endTime = calculateActivityEnd(currentTime, duration)

        entries.push({
          id: block.id,
          type: activityType,
          startTime: currentTime,
          endTime: endTime,
          title: selectedItem.name,
          subtitle: selectedItem.description,
          travelTimeFromPrevious: travelTime > 0 ? travelTime : undefined,
          data: selectedItem
        })

        currentTime = endTime
        prevSelectedItem = selectedItem
      }
    })

    // Sort all entries by start time
    entries.sort((a, b) => a.startTime.localeCompare(b.startTime))

    return entries
  }, [flights, hotel, blocks, attractions, restaurants, date])

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-stone-200">
      {/* Day Header */}
      <div className="bg-gradient-to-r from-orange-400 to-rose-400 text-white p-4">
        <h3 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
          {format(date, 'EEEE, MMMM d')}
        </h3>
      </div>

      <div className="p-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {/* Timeline with flights, hotel, and activities integrated */}
        <div className="space-y-3">
          {timeline.map((entry, index) => {
            // For flight and hotel entries, show as info cards
            if (entry.type === 'flight') {
              return (
                <div key={entry.id} className="relative">
                  <div className="border-l-4 border-sky-400 pl-4 py-3 bg-sky-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                        <span>✈️</span>
                        <span>{entry.title}</span>
                      </div>
                      <div className="text-xs text-stone-500 font-medium">
                        {formatTime(entry.startTime)} → {formatTime(entry.endTime)}
                      </div>
                    </div>
                    {entry.subtitle && (
                      <div className="text-sm text-stone-600 mt-1">{entry.subtitle}</div>
                    )}
                  </div>
                  {/* Timeline connector */}
                  {index < timeline.length - 1 && (
                    <div className="absolute left-[-2px] top-full w-1 h-3 bg-stone-200" />
                  )}
                </div>
              )
            }

            if (entry.type === 'hotel_checkin') {
              return (
                <div key={entry.id} className="relative">
                  <div className="border-l-4 border-amber-400 pl-4 py-3 bg-amber-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                        <span>🏨</span>
                        <span>{entry.title}</span>
                      </div>
                      <div className="text-xs text-stone-500 font-medium">
                        {formatTime(entry.startTime)}
                      </div>
                    </div>
                    {entry.subtitle && (
                      <div className="text-sm text-stone-600 mt-1">{entry.subtitle}</div>
                    )}
                  </div>
                  {/* Timeline connector */}
                  {index < timeline.length - 1 && (
                    <div className="absolute left-[-2px] top-full w-1 h-3 bg-stone-200" />
                  )}
                </div>
              )
            }

            // For activity/restaurant entries, show TimeBlockCard with calculated times
            const block = blocks.find(b => b.id === entry.id)
            if (!block) return null

            // Find the actual previous time block in the timeline (not just previous timeline entry)
            let previousTimeBlock: TimeBlock | null = null
            for (let i = index - 1; i >= 0; i--) {
              const prevEntry = timeline[i]
              if (prevEntry.type === 'activity' || prevEntry.type === 'restaurant') {
                previousTimeBlock = blocks.find(b => b.id === prevEntry.id) || null
                break
              }
            }

            return (
              <div key={entry.id} className="space-y-2">
                {entry.travelTimeFromPrevious && entry.travelTimeFromPrevious > 0 && (
                  <div className="flex items-center gap-2 text-xs text-stone-500 ml-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="italic">{entry.travelTimeFromPrevious} min travel</span>
                    </div>
                  </div>
                )}
                <TimeBlockCard
                  block={{
                    ...block,
                    start_time: entry.startTime,
                    end_time: entry.endTime
                  }}
                  availableAttractions={getAvailableAttractions(block)}
                  availableRestaurants={getAvailableRestaurants(block)}
                  hotel={hotel}
                  previousBlock={previousTimeBlock}
                  onUpdate={onBlockUpdate}
                  isOffline={isOffline}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
