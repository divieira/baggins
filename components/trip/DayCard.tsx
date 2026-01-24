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
  type TimelineEntry
} from '@/utils/timeline'
import TimeBlockCard from './TimeBlockCard'

interface Props {
  date: Date
  flights: Flight[]
  hotel: Hotel | null | undefined
  blocks: TimeBlock[]
  tripId: string
  onBlockUpdate: (blockId: string, updates: Partial<TimeBlock>) => Promise<void>
}

export default function DayCard({ date, flights, hotel, blocks, tripId, onBlockUpdate }: Props) {
  const [attractions, setAttractions] = useState<Attraction[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const supabase = createClient()

  useEffect(() => {
    loadSuggestions()
  }, [tripId])

  const loadSuggestions = async () => {
    const [{ data: attractionsData }, { data: restaurantsData }] = await Promise.all([
      supabase.from('attractions').select('*').eq('trip_id', tripId),
      supabase.from('restaurants').select('*').eq('trip_id', tripId)
    ])

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
    const entries: TimelineEntry[] = []

    // Add flights
    flights.forEach(flight => {
      entries.push({
        id: `flight-${flight.id}`,
        type: 'flight',
        startTime: flight.departure_time,
        endTime: flight.arrival_time,
        title: `${flight.airline} ${flight.flight_number}`,
        subtitle: `${flight.departure_airport} → ${flight.arrival_airport}`,
        data: flight
      })
    })

    // Add hotel check-in (if hotel exists and has check-in date matching this day)
    if (hotel) {
      const hotelCheckinDate = new Date(hotel.check_in_date)
      const currentDate = new Date(date)

      if (hotelCheckinDate.toDateString() === currentDate.toDateString()) {
        entries.push({
          id: `hotel-${hotel.id}`,
          type: 'hotel_checkin',
          startTime: '15:00', // Standard hotel check-in time
          endTime: '15:30',   // Allow 30 min for check-in
          title: `Check in at ${hotel.name}`,
          subtitle: hotel.address,
          data: hotel
        })
      }
    }

    // Sort by start time so far
    entries.sort((a, b) => a.startTime.localeCompare(b.startTime))

    // Calculate first activity start time
    const lastFlightArrival = flights.length > 0 ? flights[flights.length - 1].arrival_time : null
    let currentTime = calculateFirstActivityStart(lastFlightArrival, '15:00')

    // Add time blocks as activities with calculated times
    blocks.forEach((block, index) => {
      const prevBlock = index > 0 ? blocks[index - 1] : null

      // Get selected item
      let selectedItem: Attraction | Restaurant | null = null
      let activityType: 'activity' | 'restaurant' = 'activity'

      if (block.selected_attraction_id) {
        selectedItem = attractions.find(a => a.id === block.selected_attraction_id) || null
        activityType = 'activity'
      } else if (block.selected_restaurant_id) {
        selectedItem = restaurants.find(r => r.id === block.selected_restaurant_id) || null
        activityType = 'restaurant'
      }

      if (selectedItem) {
        // Calculate travel time from previous (simplified for now - will be enhanced)
        const travelTime = 15 // Default 15 min travel time

        // If not first activity, add travel time
        if (index > 0) {
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
          travelTimeFromPrevious: index > 0 ? travelTime : undefined,
          data: selectedItem
        })

        currentTime = endTime
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
                <div key={entry.id} className="border-l-4 border-sky-400 pl-4 py-3 bg-sky-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                      <span>✈️</span>
                      <span>{entry.title}</span>
                    </div>
                    <div className="text-xs text-stone-500">
                      {formatTime(entry.startTime)} → {formatTime(entry.endTime)}
                    </div>
                  </div>
                  {entry.subtitle && (
                    <div className="text-sm text-stone-600 mt-1">{entry.subtitle}</div>
                  )}
                </div>
              )
            }

            if (entry.type === 'hotel_checkin') {
              return (
                <div key={entry.id} className="border-l-4 border-amber-400 pl-4 py-3 bg-amber-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                      <span>🏨</span>
                      <span>{entry.title}</span>
                    </div>
                    <div className="text-xs text-stone-500">
                      {formatTime(entry.startTime)}
                    </div>
                  </div>
                  {entry.subtitle && (
                    <div className="text-sm text-stone-600 mt-1">{entry.subtitle}</div>
                  )}
                </div>
              )
            }

            // For activity/restaurant entries, show TimeBlockCard with calculated times
            const block = blocks.find(b => b.id === entry.id)
            if (!block) return null

            return (
              <div key={entry.id} className="space-y-2">
                {entry.travelTimeFromPrevious && (
                  <div className="flex items-center gap-2 text-xs text-stone-400 ml-4">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{entry.travelTimeFromPrevious} min travel time</span>
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
                  previousBlock={index > 0 ? blocks[index - 1] : null}
                  onUpdate={onBlockUpdate}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
