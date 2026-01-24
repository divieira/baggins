'use client'

import { useEffect } from 'react'
import { cacheTripData, type CachedTripData } from '@/lib/offline'
import type { Trip, Flight, Hotel, Traveler, PlanVersion, TripCity } from '@/types'

interface Props {
  trip: Trip
  flights: Flight[]
  hotels: Hotel[]
  travelers: Traveler[]
  cities: TripCity[]
  latestVersion: PlanVersion | null
}

/**
 * Client component that caches trip data to localStorage when mounted.
 * This enables offline access to trip details that were fetched server-side.
 */
export default function TripDataCacher({
  trip,
  flights,
  hotels,
  travelers,
  cities,
  latestVersion
}: Props) {
  useEffect(() => {
    const data: CachedTripData = {
      trip,
      travelers,
      flights,
      hotels,
      cities,
      latestVersion,
    }

    cacheTripData(trip.id, data)
  }, [trip, flights, hotels, travelers, cities, latestVersion])

  // This component doesn't render anything
  return null
}
