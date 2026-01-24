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
  isSelected,
  onSelect
}: {
  suggestion: SuggestionWithDistance
  isBestMatch: boolean
  isRestaurant: boolean
  originLocation: Location | null
  loadingTravelTimes: boolean
  isSelected?: boolean
  onSelect: () => void
}) {
  // Placeholder image when no image is available
  const placeholderImage = isRestaurant
    ? 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop'
    : 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop'

  return (
    <div
      className={`flex-shrink-0 snap-center bg-white rounded-2xl shadow-lg overflow-hidden transition-all ${
        isSelected
          ? 'border-2 border-emerald-500 ring-2 ring-emerald-100 shadow-emerald-100'
          : 'border border-stone-200 hover:shadow-xl'
      } ${isRestaurant ? 'w-[85vw] max-w-[340px]' : 'w-[85vw] max-w-[340px]'}`}
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
        {isSelected && (
          <span className="absolute top-2 right-2 text-xs bg-emerald-500 text-white px-2 py-1 rounded-full font-semibold shadow-lg">
            Selected ✓
          </span>
        )}
        {!isSelected && isBestMatch && (
          <span className="absolute top-2 right-2 text-xs bg-gradient-to-r from-orange-400 to-rose-400 text-white px-2 py-1 rounded-full font-semibold shadow-lg">
            Best match
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h4
          className="font-semibold text-base text-stone-800 cursor-pointer hover:text-orange-600 transition-colors"
          onClick={onSelect}
        >
          {isBestMatch && <span className="text-orange-500 mr-1">★</span>}
          {suggestion.name}
        </h4>
        <p className="text-sm text-stone-600 line-clamp-2 mt-1">
          {suggestion.description}
        </p>

        {/* Details - Always visible */}
        <div className="mt-2 pt-2 border-t border-stone-100 space-y-2">
          {/* Highlights/Tags */}
          {suggestion.highlights.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestion.highlights.map((highlight, i) => (
                <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100">
                  {highlight}
                </span>
              ))}
            </div>
          )}

          {/* Distance & Travel Time */}
          <div className="text-xs text-stone-600 space-y-1">
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
              className="text-orange-600 hover:text-orange-700 font-medium underline"
              onClick={(e) => e.stopPropagation()}
            >
              View on Maps
            </a>
            {originLocation && (
              <>
                <span className="text-stone-400">•</span>
                <a
                  href={generateMapsDirectionsLink(
                    originLocation,
                    { latitude: suggestion.latitude, longitude: suggestion.longitude }
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 font-medium underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Get Directions
                </a>
              </>
            )}
          </div>
        </div>

        {/* Select Button - Hidden when selected */}
        {!isSelected && (
          <button
            onClick={onSelect}
            className="mt-3 w-full bg-gradient-to-r from-orange-400 to-rose-400 hover:from-orange-500 hover:to-rose-500 text-white text-sm font-semibold py-2 px-4 rounded-xl shadow-lg shadow-orange-200 transition-all"
          >
            Select
          </button>
        )}
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
    <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Block Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 flex justify-between items-center border-b border-stone-100">
        <div>
          <span className="font-semibold text-sm text-stone-800">{getBlockLabel()}</span>
          {block.start_time && block.end_time && (
            <span className="text-xs text-stone-500 ml-2">
              {formatTime(block.start_time)} - {formatTime(block.end_time)}
            </span>
          )}
        </div>
      </div>

      {/* Horizontal Scrolling Suggestions - Always visible, selected item shown as first card */}
      {(() => {
        // Prepare display list: selected item first (if any), then suggestions
        const displayItems = selectedItem
          ? [
              {
                id: selectedItem.id,
                name: selectedItem.name,
                description: selectedItem.description,
                image_url: selectedItem.image_url,
                highlights: selectedItem.highlights,
                distance_km: hotel ? calculateDistance(
                  previousSelection?.latitude || hotel.latitude || 0,
                  previousSelection?.longitude || hotel.longitude || 0,
                  selectedItem.latitude,
                  selectedItem.longitude
                ) : 0,
                travel_time_minutes: 0,
                travel_time_text: null,
                origin_name: previousSelection?.name || hotel?.name || 'hotel',
                opening_time: selectedItem.opening_time,
                closing_time: selectedItem.closing_time,
                type: isRestaurantBlock ? ('restaurant' as const) : ('attraction' as const),
                latitude: selectedItem.latitude,
                longitude: selectedItem.longitude,
                category: 'category' in selectedItem ? selectedItem.category : undefined,
                cuisine_type: 'cuisine_type' in selectedItem ? selectedItem.cuisine_type : undefined,
                price_level: 'price_level' in selectedItem ? selectedItem.price_level : undefined,
              },
              ...suggestions
            ]
          : suggestions

        return displayItems.length > 0 ? (
          <div className="p-3 bg-gradient-to-br from-amber-50/50 to-orange-50/50">
            <div
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-3 px-3"
              style={{ scrollbarWidth: 'thin' }}
            >
              {displayItems.map((item, index) => {
                const isSelectedCard = !!(selectedItem && index === 0)
                const isBest = !isSelectedCard && index === (selectedItem ? 1 : 0)

                return (
                  <SuggestionCard
                    key={item.id}
                    suggestion={item}
                    isBestMatch={isBest}
                    isRestaurant={isRestaurantBlock}
                    originLocation={getOriginLocation()}
                    loadingTravelTimes={loadingTravelTimes && index < 5}
                    isSelected={isSelectedCard}
                    onSelect={() => handleSelect(item)}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-stone-500 italic">
            No suggestions available
          </div>
        )
      })()}
    </div>
  )
}
