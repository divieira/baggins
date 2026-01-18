'use client'

import { useState, useEffect } from 'react'
import { eachDayOfInterval, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Trip, Flight, Hotel, Traveler, PlanVersion, TimeBlock } from '@/types'
import DayCard from './DayCard'
import AIChat from '../ai/AIChat'

interface Props {
  trip: Trip
  flights: Flight[]
  hotels: Hotel[]
  travelers: Traveler[]
  initialVersion: PlanVersion | null
}

export default function TripTimeline({ trip, flights, hotels, travelers, initialVersion }: Props) {
  const [loading, setLoading] = useState(false)
  const [currentVersion, setCurrentVersion] = useState(initialVersion)
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([])
  const [showAIChat, setShowAIChat] = useState(true)
  const supabase = createClient()

  const days = eachDayOfInterval({
    start: new Date(trip.start_date),
    end: new Date(trip.end_date)
  })

  useEffect(() => {
    initializePlan()
  }, [trip.id])

  const initializePlan = async () => {
    setLoading(true)
    try {
      // If no plan version exists, create initial one
      if (!currentVersion) {
        await generateInitialPlan()
      } else {
        // Load existing time blocks
        const { data } = await supabase
          .from('time_blocks')
          .select('*')
          .eq('plan_version_id', currentVersion.id)
          .order('date')
          .order('start_time')

        if (data) {
          setTimeBlocks(data)
        }
      }
    } catch (error) {
      console.error('Error initializing plan:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateInitialPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create first plan version
      const { data: newVersion, error: versionError } = await supabase
        .from('plan_versions')
        .insert({
          trip_id: trip.id,
          version_number: 1,
          plan_data: { days: days.map(d => format(d, 'yyyy-MM-dd')) },
          created_by: user.id
        })
        .select()
        .single()

      if (versionError) throw versionError

      setCurrentVersion(newVersion)

      // Create default time blocks for each day
      const defaultBlocks = days.flatMap(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        return [
          {
            trip_id: trip.id,
            plan_version_id: newVersion.id,
            date: dateStr,
            block_type: 'morning' as const,
            start_time: '09:00',
            end_time: '12:00'
          },
          {
            trip_id: trip.id,
            plan_version_id: newVersion.id,
            date: dateStr,
            block_type: 'lunch' as const,
            start_time: '12:00',
            end_time: '13:30'
          },
          {
            trip_id: trip.id,
            plan_version_id: newVersion.id,
            date: dateStr,
            block_type: 'afternoon' as const,
            start_time: '13:30',
            end_time: '17:00'
          },
          {
            trip_id: trip.id,
            plan_version_id: newVersion.id,
            date: dateStr,
            block_type: 'dinner' as const,
            start_time: '18:00',
            end_time: '20:00'
          },
          {
            trip_id: trip.id,
            plan_version_id: newVersion.id,
            date: dateStr,
            block_type: 'evening' as const,
            start_time: '20:00',
            end_time: '23:00'
          }
        ]
      })

      const { data: blocks, error: blocksError } = await supabase
        .from('time_blocks')
        .insert(defaultBlocks)
        .select()

      if (blocksError) throw blocksError

      setTimeBlocks(blocks)

      // Trigger AI to generate suggestions
      await generateAISuggestions()
    } catch (error) {
      console.error('Error generating initial plan:', error)
    }
  }

  const generateAISuggestions = async () => {
    // This will call the AI API to generate attraction and restaurant suggestions
    // We'll implement this next
    try {
      const response = await fetch('/api/ai/generate-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: trip.id,
          destination: trip.destination,
          travelers: travelers
        })
      })

      if (response.ok) {
        // Reload the page to show new suggestions
        window.location.reload()
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error)
    }
  }

  const getDayData = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const dayFlights = flights.filter(f => f.date === dateStr)
    const dayHotel = hotels.find(h =>
      dateStr >= h.check_in_date && dateStr < h.check_out_date
    )
    const dayBlocks = timeBlocks.filter(b => b.date === dateStr)

    return { dateStr, flights: dayFlights, hotel: dayHotel, blocks: dayBlocks }
  }

  const handleBlockUpdate = async (blockId: string, updates: Partial<TimeBlock>) => {
    // Update time block with selection
    const { error } = await supabase
      .from('time_blocks')
      .update(updates)
      .eq('id', blockId)

    if (!error) {
      // Reload time blocks
      const { data } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('plan_version_id', currentVersion!.id)
        .order('date')
        .order('start_time')

      if (data) {
        setTimeBlocks(data)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading your trip plan...</div>
      </div>
    )
  }

  if (!currentVersion) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No plan created yet</p>
        <button
          onClick={generateInitialPlan}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Generate AI Plan
        </button>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {days.map(day => {
          const { dateStr, flights: dayFlights, hotel, blocks } = getDayData(day)
          return (
            <DayCard
              key={dateStr}
              date={day}
              flights={dayFlights}
              hotel={hotel}
              blocks={blocks}
              tripId={trip.id}
              onBlockUpdate={handleBlockUpdate}
            />
          )
        })}
      </div>

      {showAIChat && (
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <AIChat tripId={trip.id} />
          </div>
        </div>
      )}
    </div>
  )
}
