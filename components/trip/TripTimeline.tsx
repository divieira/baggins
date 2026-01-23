'use client'

import { useState, useEffect } from 'react'
import { eachDayOfInterval, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Trip, Flight, Hotel, Traveler, PlanVersion, TimeBlock } from '@/types'
import DayCard from './DayCard'
import FixedAIInput from '../ai/FixedAIInput'

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
  const [allVersions, setAllVersions] = useState<PlanVersion[]>(initialVersion ? [initialVersion] : [])
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([])
  const supabase = createClient()

  const days = eachDayOfInterval({
    start: new Date(trip.start_date),
    end: new Date(trip.end_date)
  })

  useEffect(() => {
    initializePlan()
  }, [trip.id])

  useEffect(() => {
    if (currentVersion) {
      loadTimeBlocks(currentVersion.id)
    }
  }, [currentVersion])

  const initializePlan = async () => {
    setLoading(true)
    try {
      // Load all versions
      const { data: versions } = await supabase
        .from('plan_versions')
        .select('*')
        .eq('trip_id', trip.id)
        .order('version_number', { ascending: true })

      if (versions && versions.length > 0) {
        setAllVersions(versions)
        // Set current version to the latest
        const latestVersion = versions[versions.length - 1]
        setCurrentVersion(latestVersion)
      } else {
        // If no plan version exists, create initial one
        await generateInitialPlan()
      }
    } catch (error) {
      console.error('Error initializing plan:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTimeBlocks = async (versionId: string) => {
    const { data } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('plan_version_id', versionId)
      .order('date')
      .order('start_time')

    if (data) {
      setTimeBlocks(data)
    }
  }

  const handleVersionChange = async (direction: 'prev' | 'next') => {
    if (!currentVersion) return

    const currentIndex = allVersions.findIndex(v => v.id === currentVersion.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
    if (newIndex >= 0 && newIndex < allVersions.length) {
      setCurrentVersion(allVersions[newIndex])
    }
  }

  const handleModificationComplete = async () => {
    // Reload all versions and time blocks
    await initializePlan()
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
      setAllVersions([newVersion])

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
    <div className="pb-24">
      {/* Version indicator */}
      {allVersions.length > 1 && (
        <div className="flex items-center justify-center gap-3 mb-4 text-sm text-slate-600">
          <button
            onClick={() => handleVersionChange('prev')}
            disabled={currentVersion?.version_number === 1}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-slate-700"
          >
            ←
          </button>
          <span>Version {currentVersion?.version_number} of {allVersions.length}</span>
          <button
            onClick={() => handleVersionChange('next')}
            disabled={currentVersion?.version_number === allVersions.length}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-slate-700"
          >
            →
          </button>
        </div>
      )}

      {/* Days */}
      <div className="space-y-6">
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

      {/* Fixed AI Input */}
      <FixedAIInput
        tripId={trip.id}
        onModificationComplete={handleModificationComplete}
      />
    </div>
  )
}
