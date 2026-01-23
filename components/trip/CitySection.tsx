'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TripCity, Attraction, Restaurant, Hotel, Traveler } from '@/types'

interface Props {
  city: TripCity
  tripId: string
  travelers: Traveler[]
  onSelectionsChange: (cityId: string, attractionIds: string[], restaurantIds: string[]) => void
  onGenerateItinerary: (cityId: string) => void
  isGenerating: boolean
}

interface SuggestionWithSelection extends Attraction {
  selected: boolean
}

interface RestaurantWithSelection extends Restaurant {
  selected: boolean
}

export default function CitySection({
  city,
  tripId,
  travelers,
  onSelectionsChange,
  onGenerateItinerary,
  isGenerating
}: Props) {
  const [attractions, setAttractions] = useState<SuggestionWithSelection[]>([])
  const [restaurants, setRestaurants] = useState<RestaurantWithSelection[]>([])
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCityData()
  }, [city.id])

  const loadCityData = async () => {
    setLoading(true)
    try {
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
        setAttractions(attractionsData.map(a => ({ ...a, selected: false })))
      }
      if (restaurantsData) {
        setRestaurants(restaurantsData.map(r => ({ ...r, selected: false })))
      }
      if (hotelData) {
        setHotel(hotelData)
      }
    } catch (error) {
      console.error('Error loading city data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateSuggestions = async () => {
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
      setAttractions(data.attractions.map((a: Attraction) => ({ ...a, selected: false })))
      setRestaurants(data.restaurants.map((r: Restaurant) => ({ ...r, selected: false })))
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
    const selectedRestaurantIds = restaurants.filter(r => r.selected).map(r => r.id)
    onSelectionsChange(city.id, selectedAttractionIds, selectedRestaurantIds)
  }

  const toggleRestaurantSelection = (id: string) => {
    const updated = restaurants.map(r =>
      r.id === id ? { ...r, selected: !r.selected } : r
    )
    setRestaurants(updated)

    const selectedAttractionIds = attractions.filter(a => a.selected).map(a => a.id)
    const selectedRestaurantIds = updated.filter(r => r.selected).map(r => r.id)
    onSelectionsChange(city.id, selectedAttractionIds, selectedRestaurantIds)
  }

  const selectedAttractionCount = attractions.filter(a => a.selected).length
  const selectedRestaurantCount = restaurants.filter(r => r.selected).length

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
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="bg-indigo-500 px-2 py-1 rounded">{selectedAttractionCount} attractions</span>
              <span className="bg-purple-500 px-2 py-1 rounded ml-2">{selectedRestaurantCount} restaurants</span>
            </div>
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
            <div className="text-center py-8 text-gray-500">Loading suggestions...</div>
          ) : attractions.length === 0 && restaurants.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No suggestions yet for {city.name}</p>
              <button
                onClick={generateSuggestions}
                disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate AI Suggestions'}
              </button>
            </div>
          ) : (
            <>
              {/* Attractions Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <span className="mr-2">🎯</span>
                  Attractions
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (Select the ones you want to visit)
                  </span>
                </h3>
                <div className="grid gap-3">
                  {attractions.map(attraction => (
                    <div
                      key={attraction.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        attraction.selected
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleAttractionSelection(attraction.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                          attraction.selected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300'
                        }`}>
                          {attraction.selected && '✓'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-medium">{attraction.name}</h4>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {attraction.is_kid_friendly && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                  Kid-friendly
                                </span>
                              )}
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                {attraction.category}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{attraction.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {attraction.opening_time && attraction.closing_time && (
                              <span>🕐 {attraction.opening_time} - {attraction.closing_time}</span>
                            )}
                            {attraction.duration_minutes && (
                              <span>⏱️ {attraction.duration_minutes} min</span>
                            )}
                            <a
                              href={getMapsUrl(attraction.latitude, attraction.longitude, attraction.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                              onClick={e => e.stopPropagation()}
                            >
                              📍 Map
                            </a>
                            {hotel && hotel.latitude && hotel.longitude && (
                              <a
                                href={getDirectionsUrl(hotel.latitude, hotel.longitude, attraction.latitude, attraction.longitude)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                                onClick={e => e.stopPropagation()}
                              >
                                🚶 Directions
                              </a>
                            )}
                          </div>
                          {attraction.highlights && attraction.highlights.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {attraction.highlights.slice(0, 3).map((h, i) => (
                                <span key={i} className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Restaurants Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <span className="mr-2">🍽️</span>
                  Restaurants
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (Select for lunch and dinner)
                  </span>
                </h3>
                <div className="grid gap-3">
                  {restaurants.map(restaurant => (
                    <div
                      key={restaurant.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        restaurant.selected
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleRestaurantSelection(restaurant.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                          restaurant.selected ? 'border-purple-500 bg-purple-500 text-white' : 'border-gray-300'
                        }`}>
                          {restaurant.selected && '✓'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-medium">{restaurant.name}</h4>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {restaurant.is_kid_friendly && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                  Kid-friendly
                                </span>
                              )}
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                {restaurant.cuisine_type}
                              </span>
                              <span className="text-xs text-gray-500">
                                {'$'.repeat(restaurant.price_level || 2)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{restaurant.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {restaurant.opening_time && restaurant.closing_time && (
                              <span>🕐 {restaurant.opening_time} - {restaurant.closing_time}</span>
                            )}
                            <a
                              href={getMapsUrl(restaurant.latitude, restaurant.longitude, restaurant.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                              onClick={e => e.stopPropagation()}
                            >
                              📍 Map
                            </a>
                            {hotel && hotel.latitude && hotel.longitude && (
                              <a
                                href={getDirectionsUrl(hotel.latitude, hotel.longitude, restaurant.latitude, restaurant.longitude)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                                onClick={e => e.stopPropagation()}
                              >
                                🚶 Directions
                              </a>
                            )}
                          </div>
                          {restaurant.highlights && restaurant.highlights.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {restaurant.highlights.slice(0, 3).map((h, i) => (
                                <span key={i} className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Itinerary Button */}
              {(selectedAttractionCount > 0 || selectedRestaurantCount > 0) && (
                <div className="border-t pt-4">
                  <button
                    onClick={() => onGenerateItinerary(city.id)}
                    disabled={isGenerating}
                    className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 font-medium"
                  >
                    {isGenerating ? 'Generating Itinerary...' : `Generate Itinerary for ${city.name}`}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    AI will create an optimal schedule based on your selections
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
