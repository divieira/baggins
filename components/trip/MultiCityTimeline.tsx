'use client'

import { useState, useEffect } from 'react'
import { eachDayOfInterval, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Trip, Flight, Hotel, Traveler, PlanVersion, TimeBlock, TripCity } from '@/types'
import CitySection from './CitySection'
import DayCard from './DayCard'
import FixedAIInput from '../ai/FixedAIInput'

interface Props {
  trip: Trip
  flights: Flight[]
  hotels: Hotel[]
  travelers: Traveler[]
  initialVersion: PlanVersion | null
  cities: TripCity[]
}

interface CitySelections {
  [cityId: string]: {
    attractionIds: string[]
    restaurantIds: string[]
  }
}

export default function MultiCityTimeline({ trip, flights, hotels, travelers, initialVersion, cities }: Props) {
  const [loading, setLoading] = useState(false)
  const [currentVersion, setCurrentVersion] = useState(initialVersion)
  const [allVersions, setAllVersions] = useState<PlanVersion[]>(initialVersion ? [initialVersion] : [])
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([])
  const [selections, setSelections] = useState<CitySelections>({})
  const [viewMode, setViewMode] = useState<'selection' | 'timeline'>('selection')
  const [generatingItinerary, setGeneratingItinerary] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (cities.length > 0) {
      loadExistingSelections()
    }
    if (initialVersion) {
      loadTimeBlocks(initialVersion.id)
    }
  }, [cities, initialVersion])

  const loadExistingSelections = async () => {
    // Check if there are any time blocks with selections - if so, show timeline view
    const { data: existingBlocks } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('trip_id', trip.id)
      .not('selected_attraction_id', 'is', null)
      .limit(1)

    if (existingBlocks && existingBlocks.length > 0) {
      setViewMode('timeline')
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

  const handleSelectionsChange = (cityId: string, attractionIds: string[], restaurantIds: string[]) => {
    setSelections(prev => ({
      ...prev,
      [cityId]: { attractionIds, restaurantIds }
    }))
  }

  const handleGenerateItinerary = async (cityId: string) => {
    const citySelections = selections[cityId]
    if (!citySelections) return

    setGeneratingItinerary(cityId)

    try {
      const response = await fetch('/api/ai/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: trip.id,
          cityId,
          selectedAttractionIds: citySelections.attractionIds,
          selectedRestaurantIds: citySelections.restaurantIds
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate itinerary')
      }

      const data = await response.json()

      // Reload versions and time blocks
      await loadAllVersions()
      setViewMode('timeline')
    } catch (error) {
      console.error('Error generating itinerary:', error)
    } finally {
      setGeneratingItinerary(null)
    }
  }

  const loadAllVersions = async () => {
    const { data: versions } = await supabase
      .from('plan_versions')
      .select('*')
      .eq('trip_id', trip.id)
      .order('version_number', { ascending: true })

    if (versions && versions.length > 0) {
      setAllVersions(versions)
      const latestVersion = versions[versions.length - 1]
      setCurrentVersion(latestVersion)
      await loadTimeBlocks(latestVersion.id)
    }
  }

  const handleVersionChange = (direction: 'prev' | 'next') => {
    if (!currentVersion) return

    const currentIndex = allVersions.findIndex(v => v.id === currentVersion.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
    if (newIndex >= 0 && newIndex < allVersions.length) {
      const newVersion = allVersions[newIndex]
      setCurrentVersion(newVersion)
      loadTimeBlocks(newVersion.id)
    }
  }

  const handleModificationComplete = async () => {
    await loadAllVersions()
  }

  const handleBlockUpdate = async (blockId: string, updates: Partial<TimeBlock>) => {
    const { error } = await supabase
      .from('time_blocks')
      .update(updates)
      .eq('id', blockId)

    if (!error && currentVersion) {
      await loadTimeBlocks(currentVersion.id)
    }
  }

  const getCityForDate = (dateStr: string): TripCity | null => {
    return cities.find(c =>
      dateStr >= c.start_date && dateStr <= c.end_date
    ) || null
  }

  const getHotelForCity = (cityId: string): Hotel | undefined => {
    return hotels.find(h => h.city_id === cityId)
  }

  const getDayData = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const city = getCityForDate(dateStr)
    const dayFlights = flights.filter(f => f.date === dateStr)
    const hotel = city ? getHotelForCity(city.id) : hotels.find(h =>
      dateStr >= h.check_in_date && dateStr < h.check_out_date
    )
    const dayBlocks = timeBlocks.filter(b => b.date === dateStr)

    return { dateStr, city, flights: dayFlights, hotel, blocks: dayBlocks }
  }

  const days = eachDayOfInterval({
    start: new Date(trip.start_date),
    end: new Date(trip.end_date)
  })

  // Group days by city for timeline view
  const daysByCity: { city: TripCity | null; days: Date[] }[] = []
  let currentCityGroup: { city: TripCity | null; days: Date[] } | null = null

  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const city = getCityForDate(dateStr)

    if (!currentCityGroup || currentCityGroup.city?.id !== city?.id) {
      if (currentCityGroup) {
        daysByCity.push(currentCityGroup)
      }
      currentCityGroup = { city, days: [day] }
    } else {
      currentCityGroup.days.push(day)
    }
  })

  if (currentCityGroup) {
    daysByCity.push(currentCityGroup)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading your trip plan...</div>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <button
          onClick={() => setViewMode('selection')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'selection'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Select Attractions
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'timeline'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          View Itinerary
        </button>
      </div>

      {viewMode === 'selection' ? (
        /* City Selection Mode */
        <div className="space-y-6">
          {cities.length === 0 ? (
            <div className="text-center py-8 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">No cities found for this trip.</p>
              <p className="text-sm text-yellow-600 mt-2">
                The trip may have been created before multi-city support was added.
              </p>
            </div>
          ) : (
            cities.map(city => (
              <CitySection
                key={city.id}
                city={city}
                tripId={trip.id}
                travelers={travelers}
                onSelectionsChange={handleSelectionsChange}
                onGenerateItinerary={handleGenerateItinerary}
                isGenerating={generatingItinerary === city.id}
              />
            ))
          )}
        </div>
      ) : (
        /* Timeline View Mode */
        <div>
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

          {/* Days grouped by city */}
          <div className="space-y-8">
            {daysByCity.map(({ city, days: cityDays }, groupIndex) => (
              <div key={city?.id || `group-${groupIndex}`}>
                {/* City Header */}
                {city && (
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-lg mb-4">
                    <h2 className="text-xl font-bold">{city.name}</h2>
                    <p className="text-sm text-indigo-100">
                      {new Date(city.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(city.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}

                {/* Days for this city */}
                <div className="space-y-6">
                  {cityDays.map(day => {
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fixed AI Input */}
      <FixedAIInput
        tripId={trip.id}
        onModificationComplete={handleModificationComplete}
      />
    </div>
  )
}
