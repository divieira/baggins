'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Flight, Hotel, TimeBlock, Attraction, Restaurant } from '@/types'
import { formatTime } from '@/utils/time'
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

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Day Header */}
      <div className="bg-teal-600 text-white p-4">
        <h3 className="text-xl font-semibold">
          {format(date, 'EEEE, MMMM d')}
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Flights */}
        {flights.length > 0 && (
          <div className="border-l-4 border-sky-500 pl-4 py-2 bg-sky-50 rounded">
            {flights.map(flight => (
              <div key={flight.id} className="mb-2 last:mb-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span>✈️</span>
                  <span>
                    {flight.airline} {flight.flight_number}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  {flight.departure_airport} ({formatTime(flight.departure_time)}) → {flight.arrival_airport} ({formatTime(flight.arrival_time)})
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hotel */}
        {hotel && (
          <div className="border-l-4 border-amber-500 pl-4 py-2 bg-amber-50 rounded">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span>🏨</span>
              <span>{hotel.name}</span>
            </div>
            <div className="text-sm text-slate-600">{hotel.address}</div>
          </div>
        )}

        {/* Time Blocks */}
        <div className="space-y-3 mt-4">
          {blocks.map((block, index) => (
            <TimeBlockCard
              key={block.id}
              block={block}
              availableAttractions={getAvailableAttractions(block)}
              availableRestaurants={getAvailableRestaurants(block)}
              hotel={hotel}
              previousBlock={index > 0 ? blocks[index - 1] : null}
              onUpdate={onBlockUpdate}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
