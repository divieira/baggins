'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cacheCityData, getCachedCityData } from '@/lib/offline'
import type { TripCity, Attraction, Restaurant, Hotel, Traveler } from '@/types'

interface Props {
  city: TripCity
  tripId: string
  travelers: Traveler[]
  onSelectionsChange: (cityId: string, attractionIds: string[], restaurantIds: string[]) => void
  onGenerateItinerary: (cityId: string) => void
  isGenerating: boolean
  isOffline?: boolean
}

interface SuggestionWithSelection extends Attraction {
  selected: boolean
}

export default function CitySection({
  city,
  tripId,
  travelers,
  onSelectionsChange,
  onGenerateItinerary,
  isGenerating,
  isOffline = false
}: Props) {
  const [attractions, setAttractions] = useState<SuggestionWithSelection[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [usingCachedData, setUsingCachedData] = useState(false)
  const supabase = createClient()

  // Load persisted selections from localStorage
  const getPersistedSelections = (): string[] => {
    if (typeof window === 'undefined') return []
    const key = `city-selections-${city.id}`
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  }

  // Save selections to localStorage
  const persistSelections = (selectedIds: string[]) => {
    if (typeof window === 'undefined') return
    const key = `city-selections-${city.id}`
    localStorage.setItem(key, JSON.stringify(selectedIds))
  }

  const loadCityData = useCallback(async () => {
    setLoading(true)
    try {
      // Get persisted selections first (this always works, even offline)
      const persistedSelections = getPersistedSelections()

      // Try to load from network if online
      if (!isOffline) {
        const [
          { data: attractionsData },
          { data: restaurantsData },
          { data: hotelData }
        ] = await Promise.all([
          supabase.from('attractions').select('*').eq('city_id', city.id),
          supabase.from('restaurants').select('*').eq('city_id', city.id),
          supabase.from('hotels').select('*').eq('city_id', city.id).single()
        ])

        if (attractionsData) {
          setAttractions(attractionsData.map(a => ({
            ...a,
            selected: persistedSelections.includes(a.id)
          })))

          // Notify parent of initial selections
          if (persistedSelections.length > 0) {
            onSelectionsChange(city.id, persistedSelections, [])
          }
        }
        if (restaurantsData) {
          setRestaurants(restaurantsData)
        }
        if (hotelData) {
          setHotel(hotelData)
        }

        // Cache the data for offline use
        if (attractionsData || restaurantsData || hotelData) {
          cacheCityData(city.id, {
            attractions: attractionsData || [],
            restaurants: restaurantsData || [],
            hotel: hotelData || null,
          })
          setUsingCachedData(false)
        }
        return
      }

      // Fall back to cache if offline
      const cached = getCachedCityData(city.id)
      if (cached) {
        setAttractions(cached.attractions.map(a => ({
          ...a,
          selected: persistedSelections.includes(a.id)
        })))
        setRestaurants(cached.restaurants)
        setHotel(cached.hotel)
        setUsingCachedData(true)

        // Notify parent of initial selections
        if (persistedSelections.length > 0) {
          onSelectionsChange(city.id, persistedSelections, [])
        }
      }
    } catch (error) {
      console.error('Error loading city data:', error)

      // Try cache on error
      const cached = getCachedCityData(city.id)
      if (cached) {
        const persistedSelections = getPersistedSelections()
        setAttractions(cached.attractions.map(a => ({
          ...a,
          selected: persistedSelections.includes(a.id)
        })))
        setRestaurants(cached.restaurants)
        setHotel(cached.hotel)
        setUsingCachedData(true)
      }
    } finally {
      setLoading(false)
    }
  }, [city.id, isOffline, supabase, onSelectionsChange])

  useEffect(() => {
    loadCityData()
  }, [loadCityData])

  const generateSuggestions = async () => {
    if (isOffline) {
      console.warn('Cannot generate suggestions while offline')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/ai/generate-city-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          cityId: city.id,
          cityName: city.name,
          travelers
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate suggestions')
      }

      const data = await response.json()
      const newAttractions = data.attractions.map((a: Attraction) => ({ ...a, selected: false }))
      setAttractions(newAttractions)
      setRestaurants(data.restaurants)

      // Cache the newly generated data
      cacheCityData(city.id, {
        attractions: data.attractions,
        restaurants: data.restaurants,
        hotel: hotel,
      })
    } catch (error) {
      console.error('Error generating suggestions:', error)
    } finally {
      setGenerating(false)
    }
  }

  const toggleAttractionSelection = (id: string) => {
    const updated = attractions.map(a =>
      a.id === id ? { ...a, selected: !a.selected } : a
    )
    setAttractions(updated)

    const selectedAttractionIds = updated.filter(a => a.selected).map(a => a.id)

    // Persist selections
    persistSelections(selectedAttractionIds)

    // Notify parent (restaurants will be auto-selected by AI during itinerary generation)
    onSelectionsChange(city.id, selectedAttractionIds, [])
  }

  const selectedAttractionCount = attractions.filter(a => a.selected).length

  const getMapsUrl = (lat: number, lon: number, name: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query=${lat},${lon}`
  }

  const getDirectionsUrl = (fromLat: number, fromLon: number, toLat: number, toLon: number) => {
    return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLon}&destination=${toLat},${toLon}&travelmode=walking`
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      {/* City Header */}
      <div
        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">{city.name}</h2>
            <p className="text-sm text-indigo-100">
              {new Date(city.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(city.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            {usingCachedData && (
              <p className="text-xs text-indigo-200 mt-1">Showing cached data</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {selectedAttractionCount > 0 && (
              <span className="bg-indigo-500 px-3 py-1 rounded-full text-sm font-medium">
                {selectedAttractionCount} selected
              </span>
            )}
            <span className="text-2xl">{expanded ? '▼' : '▶'}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-4">
          {/* Hotel Info */}
          {hotel && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg mr-2">🏨</span>
                  <span className="font-semibold">{hotel.name}</span>
                  <p className="text-sm text-gray-600 ml-6">{hotel.address}</p>
                </div>
                {hotel.latitude && hotel.longitude && (
                  <a
                    href={getMapsUrl(hotel.latitude, hotel.longitude, hotel.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View on Map →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Loading/Generate State */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading attractions...</div>
          ) : attractions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No attractions yet for {city.name}</p>
              {isOffline ? (
                <p className="text-amber-600 text-sm">You&apos;re offline. Connect to the internet to generate suggestions.</p>
              ) : (
                <button
                  onClick={generateSuggestions}
                  disabled={generating}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  {generating ? 'Generating...' : 'Generate AI Suggestions'}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Attractions Grid */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <span className="mr-2">🎯</span>
                  Select Attractions to Visit
                  {isOffline && <span className="ml-2 text-xs text-amber-600 font-normal">(Read-only while offline)</span>}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {attractions.map(attraction => (
                    <div
                      key={attraction.id}
                      className={`border rounded-lg overflow-hidden cursor-pointer transition-all ${
                        attraction.selected
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${isOffline ? 'opacity-75' : ''}`}
                      onClick={() => !isOffline && toggleAttractionSelection(attraction.id)}
                    >
                      {/* Image */}
                      <div className="relative h-40 bg-gray-100">
                        <img
                          src={attraction.image_url || `https://source.unsplash.com/400x300/?${encodeURIComponent(attraction.name)}`}
                          alt={attraction.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop'
                          }}
                        />
                        {/* Selection checkbox overlay */}
                        <div className={`absolute top-2 right-2 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                          attraction.selected
                            ? 'border-indigo-500 bg-indigo-500 text-white'
                            : 'border-white bg-white/80 text-gray-400'
                        }`}>
                          {attraction.selected ? '✓' : ''}
                        </div>
                        {/* Category badge */}
                        <span className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded">
                          {attraction.category}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-gray-900">{attraction.name}</h4>
                          {attraction.is_kid_friendly && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex-shrink-0">
                              Kid-friendly
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{attraction.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {attraction.opening_time && attraction.closing_time && (
                            <span>🕐 {attraction.opening_time} - {attraction.closing_time}</span>
                          )}
                          {attraction.duration_minutes && (
                            <span>⏱️ {attraction.duration_minutes} min</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <a
                            href={getMapsUrl(attraction.latitude, attraction.longitude, attraction.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800"
                            onClick={e => e.stopPropagation()}
                          >
                            📍 Map
                          </a>
                          {hotel && hotel.latitude && hotel.longitude && (
                            <a
                              href={getDirectionsUrl(hotel.latitude, hotel.longitude, attraction.latitude, attraction.longitude)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800"
                              onClick={e => e.stopPropagation()}
                            >
                              🚶 Directions
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Itinerary Button */}
              <div className="sticky bottom-4 pt-4 bg-gradient-to-t from-white via-white to-transparent">
                <button
                  onClick={() => onGenerateItinerary(city.id)}
                  disabled={isGenerating || selectedAttractionCount === 0 || isOffline}
                  className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
                    selectedAttractionCount > 0 && !isOffline
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating Itinerary...
                    </span>
                  ) : isOffline ? (
                    'Connect to internet to generate itinerary'
                  ) : selectedAttractionCount > 0 ? (
                    `Generate Itinerary with ${selectedAttractionCount} Attraction${selectedAttractionCount > 1 ? 's' : ''}`
                  ) : (
                    'Select Attractions to Generate Itinerary'
                  )}
                </button>
                {selectedAttractionCount > 0 && !isOffline && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    AI will create an optimal schedule and select restaurants for you
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
