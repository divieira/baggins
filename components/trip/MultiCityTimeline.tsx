'use client'

import { useState, useEffect, useCallback } from 'react'
import { eachDayOfInterval, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import {
  useIsOnline,
  cacheTimeBlocks,
  getCachedTimeBlocks,
  cacheAllVersions,
  getCachedAllVersions,
} from '@/lib/offline'
import type { Trip, Flight, Hotel, Traveler, PlanVersion, TimeBlock, TripCity } from '@/types'
import CitySection from './CitySection'
import DayCard from './DayCard'
import FixedAIInput from '../ai/FixedAIInput'
import OfflineBanner from '../offline/OfflineBanner'

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
  const [generatingItinerary, setGeneratingItinerary] = useState(false)
  const [usingCachedData, setUsingCachedData] = useState(false)
  const supabase = createClient()
  const isOnline = useIsOnline()

  const loadTimeBlocks = useCallback(async (versionId: string) => {
    // Try to load from network first if online
    if (isOnline) {
      const { data } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('plan_version_id', versionId)
        .order('date')
        .order('start_time')

      if (data) {
        setTimeBlocks(data)
        // Cache the data
        cacheTimeBlocks(trip.id, versionId, data)
        setUsingCachedData(false)
        return
      }
    }

    // Fall back to cache if offline or network failed
    const cached = getCachedTimeBlocks(trip.id, versionId)
    if (cached) {
      setTimeBlocks(cached)
      setUsingCachedData(true)
    }
  }, [isOnline, supabase, trip.id])

  const loadExistingSelections = useCallback(async () => {
    if (!isOnline) {
      // When offline, check cached time blocks for existing selections
      if (currentVersion) {
        const cached = getCachedTimeBlocks(trip.id, currentVersion.id)
        if (cached && cached.some(b => b.selected_attraction_id)) {
          setViewMode('timeline')
        }
      }
      return
    }

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
  }, [isOnline, supabase, trip.id, currentVersion])

  useEffect(() => {
    if (cities.length > 0) {
      loadExistingSelections()
    }
    if (initialVersion) {
      loadTimeBlocks(initialVersion.id)
    }
  }, [cities.length, initialVersion, loadExistingSelections, loadTimeBlocks])

  const handleSelectionsChange = (cityId: string, attractionIds: string[], restaurantIds: string[]) => {
    setSelections(prev => ({
      ...prev,
      [cityId]: { attractionIds, restaurantIds }
    }))
  }

  const handleGenerateItinerary = async () => {
    if (!isOnline) {
      console.warn('Cannot generate itinerary while offline')
      return
    }

    // Get all cities with selections
    const citiesToGenerate = Object.keys(selections).filter(
      cityId => selections[cityId].attractionIds.length > 0
    )

    if (citiesToGenerate.length === 0) return

    setGeneratingItinerary(true)

    try {
      // Generate itineraries for all cities with selections
      for (const cityId of citiesToGenerate) {
        const citySelections = selections[cityId]
        const response = await fetch('/api/ai/generate-itinerary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: trip.id,
            cityId,
            selectedAttractionIds: citySelections.attractionIds
            // Restaurant selection is automatic - AI picks best restaurants
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to generate itinerary for city ${cityId}`)
        }
      }

      // Reload versions and time blocks
      await loadAllVersions()
      setViewMode('timeline')
    } catch (error) {
      console.error('Error generating itinerary:', error)
    } finally {
      setGeneratingItinerary(false)
    }
  }

  const loadAllVersions = async () => {
    // Try to load from network first if online
    if (isOnline) {
      const { data: versions } = await supabase
        .from('plan_versions')
        .select('*')
        .eq('trip_id', trip.id)
        .order('version_number', { ascending: true })

      if (versions && versions.length > 0) {
        setAllVersions(versions)
        const latestVersion = versions[versions.length - 1]
        setCurrentVersion(latestVersion)
        // Cache the versions
        cacheAllVersions(trip.id, versions)
        await loadTimeBlocks(latestVersion.id)
        return
      }
    }

    // Fall back to cache if offline or network failed
    const cachedVersions = getCachedAllVersions(trip.id)
    if (cachedVersions && cachedVersions.length > 0) {
      setAllVersions(cachedVersions)
      const latestVersion = cachedVersions[cachedVersions.length - 1]
      setCurrentVersion(latestVersion)
      setUsingCachedData(true)
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
    if (isOnline) {
      await loadAllVersions()
    }
  }

  const handleBlockUpdate = async (blockId: string, updates: Partial<TimeBlock>) => {
    if (!isOnline) {
      console.warn('Cannot update blocks while offline')
      return
    }

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
      {/* Offline Banner */}
      <OfflineBanner showWhenOnline={usingCachedData} />

      {/* Cached data indicator */}
      {usingCachedData && isOnline && (
        <div className="mb-4 text-center text-sm text-gray-500">
          Showing cached data. <button onClick={() => loadAllVersions()} className="text-indigo-600 hover:underline">Refresh</button>
        </div>
      )}

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
                isOffline={!isOnline}
              />
            ))
          )}

          {/* Generate Itinerary Button for All Cities */}
          {cities.length > 0 && (
            <div className="sticky bottom-4 mt-6 pt-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
              <button
                onClick={handleGenerateItinerary}
                disabled={generatingItinerary || Object.keys(selections).every(cityId => selections[cityId].attractionIds.length === 0) || !isOnline}
                className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
                  Object.keys(selections).some(cityId => selections[cityId].attractionIds.length > 0) && isOnline
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                } disabled:opacity-50`}
              >
                {generatingItinerary ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating Itineraries...
                  </span>
                ) : !isOnline ? (
                  'Connect to internet to generate itinerary'
                ) : Object.keys(selections).some(cityId => selections[cityId].attractionIds.length > 0) ? (
                  `Generate Itinerary${Object.keys(selections).length > 1 ? ' for All Cities' : ''}`
                ) : (
                  'Select Attractions to Generate Itinerary'
                )}
              </button>
              {Object.keys(selections).some(cityId => selections[cityId].attractionIds.length > 0) && isOnline && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  AI will create an optimal schedule and select restaurants for you
                </p>
              )}
            </div>
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
                        isOffline={!isOnline}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fixed AI Input - only show when online */}
      {isOnline && (
        <FixedAIInput
          tripId={trip.id}
          onModificationComplete={handleModificationComplete}
        />
      )}
    </div>
  )
}
