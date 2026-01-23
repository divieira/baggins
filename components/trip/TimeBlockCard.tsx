'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TimeBlock, Attraction, Restaurant, Hotel } from '@/types'
import { formatTime } from '@/utils/time'
import { calculateDistance, estimateTravelTime, formatDistance, formatTravelTime } from '@/utils/distance'
import { generateMapsSearchLink, generateMapsDirectionsLink, type TravelTimeResult, type Location } from '@/utils/google-maps'

interface Props {
  block: TimeBlock
  availableAttractions: Attraction[]
  availableRestaurants: Restaurant[]
  hotel: Hotel | null | undefined
  previousBlock?: TimeBlock | null
  onUpdate: (blockId: string, updates: Partial<TimeBlock>) => Promise<void>
}

interface SuggestionWithDistance {
  id: string
  name: string
  description: string
  image_url: string | null
  highlights: string[]
  distance_km: number
  travel_time_minutes: number
  travel_time_text: string | null
  origin_name: string
  opening_time: string | null
  closing_time: string | null
  type: 'attraction' | 'restaurant'
  latitude: number
  longitude: number
  category?: string
  cuisine_type?: string
  price_level?: number
}

export default function TimeBlockCard({
  block,
  availableAttractions,
  availableRestaurants,
  hotel,
  previousBlock,
  onUpdate
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Attraction | Restaurant | null>(null)
  const [previousSelection, setPreviousSelection] = useState<Attraction | Restaurant | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionWithDistance[]>([])
  const [loadingTravelTimes, setLoadingTravelTimes] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadSelectedItem()
    loadPreviousSelection()
  }, [block, previousBlock])

  useEffect(() => {
    calculateSuggestions()
  }, [block, availableAttractions, availableRestaurants, hotel, previousSelection])

  const loadSelectedItem = async () => {
    if (block.selected_attraction_id) {
      const { data } = await supabase
        .from('attractions')
        .select('*')
        .eq('id', block.selected_attraction_id)
        .single()
      if (data) setSelectedItem(data)
    } else if (block.selected_restaurant_id) {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', block.selected_restaurant_id)
        .single()
      if (data) setSelectedItem(data)
    } else {
      setSelectedItem(null)
    }
  }

  const loadPreviousSelection = async () => {
    if (!previousBlock) {
      setPreviousSelection(null)
      return
    }

    if (previousBlock.selected_attraction_id) {
      const { data } = await supabase
        .from('attractions')
        .select('*')
        .eq('id', previousBlock.selected_attraction_id)
        .single()
      if (data) setPreviousSelection(data)
    } else if (previousBlock.selected_restaurant_id) {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', previousBlock.selected_restaurant_id)
        .single()
      if (data) setPreviousSelection(data)
    } else {
      setPreviousSelection(null)
    }
  }

  const calculateSuggestions = async () => {
    if (!hotel) return

    // Determine origin location: previous selection or hotel
    let originLocation: Location
    let originName: string

    if (previousSelection) {
      originLocation = {
        latitude: previousSelection.latitude,
        longitude: previousSelection.longitude
      }
      originName = previousSelection.name
    } else {
      originLocation = {
        latitude: hotel.latitude || 0,
        longitude: hotel.longitude || 0
      }
      originName = hotel.name
    }

    let suggestions: SuggestionWithDistance[] = []

    if (block.block_type === 'lunch' || block.block_type === 'dinner') {
      // Restaurant suggestions
      suggestions = availableRestaurants.map(r => {
        const distance = calculateDistance(originLocation.latitude, originLocation.longitude, r.latitude, r.longitude)
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          image_url: r.image_url,
          highlights: r.highlights,
          distance_km: distance,
          travel_time_minutes: estimateTravelTime(distance),
          travel_time_text: null,
          origin_name: originName,
          opening_time: r.opening_time,
          closing_time: r.closing_time,
          type: 'restaurant' as const,
          latitude: r.latitude,
          longitude: r.longitude,
          cuisine_type: r.cuisine_type,
          price_level: r.price_level
        }
      })
    } else {
      // Attraction suggestions
      suggestions = availableAttractions.map(a => {
        const distance = calculateDistance(originLocation.latitude, originLocation.longitude, a.latitude, a.longitude)
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          image_url: a.image_url,
          highlights: a.highlights,
          distance_km: distance,
          travel_time_minutes: estimateTravelTime(distance),
          travel_time_text: null,
          origin_name: originName,
          opening_time: a.opening_time,
          closing_time: a.closing_time,
          type: 'attraction' as const,
          latitude: a.latitude,
          longitude: a.longitude,
          category: a.category
        }
      })
    }

    // Sort by distance (closest first)
    suggestions.sort((a, b) => a.distance_km - b.distance_km)

    setSuggestions(suggestions)

    // Fetch real travel times for top 5 suggestions if Google Maps API is configured
    if (suggestions.length > 0) {
      fetchRealTravelTimes(suggestions.slice(0, 5), originLocation)
    }
  }

  const fetchRealTravelTimes = async (topSuggestions: SuggestionWithDistance[], origin: Location) => {
    setLoadingTravelTimes(true)

    try {
      const updatedSuggestions = await Promise.all(
        topSuggestions.map(async (suggestion) => {
          try {
            const response = await fetch('/api/travel-time', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                origin,
                destination: {
                  latitude: suggestion.latitude,
                  longitude: suggestion.longitude
                },
                mode: 'driving'
              })
            })

            if (response.ok) {
              const result: TravelTimeResult = await response.json()
              return {
                ...suggestion,
                travel_time_text: result.durationText,
                travel_time_minutes: Math.ceil(result.durationSeconds / 60)
              }
            }
          } catch (error) {
            console.error('Error fetching travel time:', error)
          }

          return suggestion
        })
      )

      // Update suggestions with real travel times
      setSuggestions(prevSuggestions =>
        prevSuggestions.map(s => {
          const updated = updatedSuggestions.find(u => u.id === s.id)
          return updated || s
        })
      )
    } finally {
      setLoadingTravelTimes(false)
    }
  }

  const handleSelect = async (suggestion: SuggestionWithDistance) => {
    const updates: Partial<TimeBlock> = {
      selected_attraction_id: suggestion.type === 'attraction' ? suggestion.id : null,
      selected_restaurant_id: suggestion.type === 'restaurant' ? suggestion.id : null
    }

    await onUpdate(block.id, updates)
    setExpanded(false)
  }

  const handleClear = async () => {
    const updates: Partial<TimeBlock> = {
      selected_attraction_id: null,
      selected_restaurant_id: null
    }

    await onUpdate(block.id, updates)
  }

  const getBlockLabel = () => {
    switch (block.block_type) {
      case 'morning': return 'Morning Activity'
      case 'lunch': return 'Lunch'
      case 'afternoon': return 'Afternoon Activity'
      case 'dinner': return 'Dinner'
      case 'evening': return 'Evening Activity'
      default: return 'Activity'
    }
  }

  const getOriginLocation = (): Location | null => {
    if (previousSelection) {
      return {
        latitude: previousSelection.latitude,
        longitude: previousSelection.longitude
      }
    }
    if (hotel) {
      return {
        latitude: hotel.latitude || 0,
        longitude: hotel.longitude || 0
      }
    }
    return null
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Block Header */}
      <div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
        <div>
          <span className="font-medium text-sm">{getBlockLabel()}</span>
          <span className="text-xs text-gray-500 ml-2">
            {formatTime(block.start_time)} - {formatTime(block.end_time)}
          </span>
        </div>
        {selectedItem && (
          <button
            onClick={handleClear}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Clear
          </button>
        )}
      </div>

      {/* Selected Item or Suggestions */}
      {selectedItem ? (
        <div className="p-4 bg-green-50 border-l-4 border-green-500">
          <div className="flex gap-3">
            {selectedItem.image_url && (
              <img
                src={selectedItem.image_url}
                alt={selectedItem.name}
                className="w-20 h-20 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{selectedItem.name}</h4>
              <p className="text-xs text-gray-600 line-clamp-2">{selectedItem.description}</p>
              {hotel && (
                <div className="space-y-1 mt-2">
                  <p className="text-xs text-gray-500">
                    {formatDistance(
                      calculateDistance(
                        previousSelection?.latitude || hotel.latitude || 0,
                        previousSelection?.longitude || hotel.longitude || 0,
                        selectedItem.latitude,
                        selectedItem.longitude
                      )
                    )} from {previousSelection?.name || hotel.name} • {formatTravelTime(
                      estimateTravelTime(
                        calculateDistance(
                          previousSelection?.latitude || hotel.latitude || 0,
                          previousSelection?.longitude || hotel.longitude || 0,
                          selectedItem.latitude,
                          selectedItem.longitude
                        )
                      )
                    )}
                  </p>
                  <div className="flex gap-2 text-xs">
                    <a
                      href={generateMapsSearchLink(
                        { latitude: selectedItem.latitude, longitude: selectedItem.longitude },
                        selectedItem.name
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      View on Maps
                    </a>
                    {getOriginLocation() && (
                      <>
                        <span className="text-gray-400">•</span>
                        <a
                          href={generateMapsDirectionsLink(
                            getOriginLocation()!,
                            { latitude: selectedItem.latitude, longitude: selectedItem.longitude }
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Get Directions
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
          >
            {expanded ? 'Show less' : 'Change selection'}
          </button>
        </div>
      ) : (
        <div className="p-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {suggestions.length > 0 ? `View ${suggestions.length} suggestions` : 'No suggestions yet'}
          </button>
        </div>
      )}

      {/* Expanded Suggestions */}
      {expanded && suggestions.length > 0 && (
        <div className="border-t border-gray-200 bg-white max-h-96 overflow-y-auto">
          {suggestions.slice(0, 5).map((suggestion, index) => (
            <div
              key={suggestion.id}
              className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer"
              onClick={() => handleSelect(suggestion)}
            >
              <div className="flex gap-3">
                {suggestion.image_url && (
                  <img
                    src={suggestion.image_url}
                    alt={suggestion.name}
                    className="w-20 h-20 object-cover rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm">
                      {index === 0 && <span className="text-green-600 mr-1">★</span>}
                      {suggestion.name}
                    </h4>
                    {index === 0 && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex-shrink-0">
                        Best match
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                    {suggestion.description}
                  </p>
                  {suggestion.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {suggestion.highlights.slice(0, 3).map((highlight, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {highlight}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{formatDistance(suggestion.distance_km)} from {suggestion.origin_name}</span>
                    <span>•</span>
                    <span>
                      {suggestion.travel_time_text || formatTravelTime(suggestion.travel_time_minutes)}
                      {loadingTravelTimes && index < 5 && !suggestion.travel_time_text && ' (updating...)'}
                    </span>
                    {suggestion.opening_time && suggestion.closing_time && (
                      <>
                        <span>•</span>
                        <span>
                          Open {formatTime(suggestion.opening_time)} - {formatTime(suggestion.closing_time)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs mt-2">
                    <a
                      href={generateMapsSearchLink(
                        { latitude: suggestion.latitude, longitude: suggestion.longitude },
                        suggestion.name
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Maps
                    </a>
                    {getOriginLocation() && (
                      <>
                        <span className="text-gray-400">•</span>
                        <a
                          href={generateMapsDirectionsLink(
                            getOriginLocation()!,
                            { latitude: suggestion.latitude, longitude: suggestion.longitude }
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Get Directions
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
