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

function SuggestionCard({
  suggestion,
  isBestMatch,
  isRestaurant,
  originLocation,
  loadingTravelTimes,
  onSelect
}: {
  suggestion: SuggestionWithDistance
  isBestMatch: boolean
  isRestaurant: boolean
  originLocation: Location | null
  loadingTravelTimes: boolean
  onSelect: () => void
}) {
  // Placeholder image when no image is available
  const placeholderImage = isRestaurant
    ? 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop'
    : 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop'

  return (
    <div
      className={`flex-shrink-0 snap-center bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 ${
        isRestaurant ? 'w-[85vw] max-w-[340px]' : 'w-[85vw] max-w-[340px]'
      }`}
    >
      {/* Photo */}
      <div
        className={`relative w-full ${isRestaurant ? 'h-32' : 'h-48'}`}
        onClick={onSelect}
      >
        <img
          src={suggestion.image_url || placeholderImage}
          alt={suggestion.name}
          className="w-full h-full object-cover cursor-pointer"
        />
        {isBestMatch && (
          <span className="absolute top-2 right-2 text-xs bg-emerald-500 text-white px-2 py-1 rounded-full font-medium shadow">
            Best match
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h4
          className="font-semibold text-base text-slate-800 cursor-pointer hover:text-teal-600"
          onClick={onSelect}
        >
          {isBestMatch && <span className="text-emerald-500 mr-1">★</span>}
          {suggestion.name}
        </h4>
        <p className="text-sm text-slate-600 line-clamp-2 mt-1">
          {suggestion.description}
        </p>

        {/* Details - Always visible */}
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
          {/* Highlights/Tags */}
          {suggestion.highlights.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestion.highlights.map((highlight, i) => (
                <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {highlight}
                </span>
              ))}
            </div>
          )}

          {/* Distance & Travel Time */}
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              {formatDistance(suggestion.distance_km)} from {suggestion.origin_name} •{' '}
              {suggestion.travel_time_text || formatTravelTime(suggestion.travel_time_minutes)}
              {loadingTravelTimes && !suggestion.travel_time_text && ' (updating...)'}
            </p>
            {suggestion.opening_time && suggestion.closing_time && (
              <p>
                Open {formatTime(suggestion.opening_time)} - {formatTime(suggestion.closing_time)}
              </p>
            )}
          </div>

          {/* Map Links */}
          <div className="flex gap-2 text-xs">
            <a
              href={generateMapsSearchLink(
                { latitude: suggestion.latitude, longitude: suggestion.longitude },
                suggestion.name
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 hover:text-teal-700 underline"
              onClick={(e) => e.stopPropagation()}
            >
              View on Maps
            </a>
            {originLocation && (
              <>
                <span className="text-slate-400">•</span>
                <a
                  href={generateMapsDirectionsLink(
                    originLocation,
                    { latitude: suggestion.latitude, longitude: suggestion.longitude }
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:text-teal-700 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Get Directions
                </a>
              </>
            )}
          </div>
        </div>

        {/* Select Button */}
        <button
          onClick={onSelect}
          className="mt-3 w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Select
        </button>
      </div>
    </div>
  )
}

export default function TimeBlockCard({
  block,
  availableAttractions,
  availableRestaurants,
  hotel,
  previousBlock,
  onUpdate
}: Props) {
  const [selectedItem, setSelectedItem] = useState<Attraction | Restaurant | null>(null)
  const [previousSelection, setPreviousSelection] = useState<Attraction | Restaurant | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionWithDistance[]>([])
  const [loadingTravelTimes, setLoadingTravelTimes] = useState(false)
  const supabase = createClient()

  const isRestaurantBlock = block.block_type === 'lunch' || block.block_type === 'dinner'

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

    // Fetch real travel times for top 10 suggestions if Google Maps API is configured
    if (suggestions.length > 0) {
      fetchRealTravelTimes(suggestions.slice(0, 10), originLocation)
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
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Block Header */}
      <div className="bg-slate-50 px-4 py-2 flex justify-between items-center">
        <div>
          <span className="font-medium text-sm text-slate-800">{getBlockLabel()}</span>
          <span className="text-xs text-slate-500 ml-2">
            {formatTime(block.start_time)} - {formatTime(block.end_time)}
          </span>
        </div>
        {selectedItem && (
          <button
            onClick={handleClear}
            className="text-xs text-rose-600 hover:text-rose-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Selected Item Display */}
      {selectedItem && (
        <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500">
          <div className="flex gap-3">
            <img
              src={selectedItem.image_url || (isRestaurantBlock
                ? 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=80&h=80&fit=crop'
                : 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=80&h=80&fit=crop')}
              alt={selectedItem.name}
              className="w-16 h-16 object-cover rounded flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-slate-800">{selectedItem.name}</h4>
              <p className="text-xs text-slate-600 line-clamp-1">{selectedItem.description}</p>
              {hotel && (
                <p className="text-xs text-slate-500 mt-1">
                  {formatDistance(
                    calculateDistance(
                      previousSelection?.latitude || hotel.latitude || 0,
                      previousSelection?.longitude || hotel.longitude || 0,
                      selectedItem.latitude,
                      selectedItem.longitude
                    )
                  )} from {previousSelection?.name || hotel.name}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Horizontal Scrolling Suggestions - Hidden when item is selected */}
      {!selectedItem && suggestions.length > 0 ? (
        <div className="p-3 bg-slate-50">
          <div
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-3 px-3"
            style={{ scrollbarWidth: 'thin' }}
          >
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                isBestMatch={index === 0}
                isRestaurant={isRestaurantBlock}
                originLocation={getOriginLocation()}
                loadingTravelTimes={loadingTravelTimes && index < 5}
                onSelect={() => handleSelect(suggestion)}
              />
            ))}
          </div>
        </div>
      ) : !selectedItem ? (
        <div className="p-4 text-center text-sm text-slate-600">
          No suggestions available
        </div>
      ) : null}
    </div>
  )
}
