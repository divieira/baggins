/**
 * Offline cache utility for storing trip data in localStorage
 * Provides read-only access when the browser is offline
 */

import type {
  Trip,
  Traveler,
  Flight,
  Hotel,
  Attraction,
  Restaurant,
  TimeBlock,
  PlanVersion,
  TripCity,
} from '@/types'

// Cache keys
const CACHE_PREFIX = 'baggins-offline'
const CACHE_VERSION = 'v1'
const CACHE_METADATA_KEY = `${CACHE_PREFIX}-metadata-${CACHE_VERSION}`

// Cache entry structure
interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface CacheMetadata {
  tripIds: string[]
  lastUpdated: number
}

// Default cache duration: 7 days
const DEFAULT_CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000

// Type definitions for cached data
export interface CachedTripData {
  trip: Trip
  travelers: Traveler[]
  flights: Flight[]
  hotels: Hotel[]
  cities: TripCity[]
  latestVersion: PlanVersion | null
}

export interface CachedCityData {
  attractions: Attraction[]
  restaurants: Restaurant[]
  hotel: Hotel | null
}

export interface CachedTimeBlocks {
  blocks: TimeBlock[]
  versionId: string
}

// Helper to check if localStorage is available
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const testKey = '__localStorage_test__'
    window.localStorage.setItem(testKey, testKey)
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

// Generate cache keys
function getTripKey(tripId: string): string {
  return `${CACHE_PREFIX}-trip-${CACHE_VERSION}-${tripId}`
}

function getCityKey(cityId: string): string {
  return `${CACHE_PREFIX}-city-${CACHE_VERSION}-${cityId}`
}

function getTimeBlocksKey(tripId: string, versionId: string): string {
  return `${CACHE_PREFIX}-timeblocks-${CACHE_VERSION}-${tripId}-${versionId}`
}

function getAllVersionsKey(tripId: string): string {
  return `${CACHE_PREFIX}-versions-${CACHE_VERSION}-${tripId}`
}

// Generic cache operations
function setCache<T>(key: string, data: T, durationMs: number = DEFAULT_CACHE_DURATION_MS): void {
  if (!isLocalStorageAvailable()) return

  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + durationMs,
  }

  try {
    localStorage.setItem(key, JSON.stringify(entry))
  } catch (error) {
    // Handle quota exceeded - clear old cache entries
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      clearExpiredCache()
      try {
        localStorage.setItem(key, JSON.stringify(entry))
      } catch {
        // Still failing, clear all cache
        clearAllCache()
      }
    }
  }
}

function getCache<T>(key: string): T | null {
  if (!isLocalStorageAvailable()) return null

  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const entry: CacheEntry<T> = JSON.parse(stored)

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key)
      return null
    }

    return entry.data
  } catch {
    return null
  }
}

function removeCache(key: string): void {
  if (!isLocalStorageAvailable()) return
  localStorage.removeItem(key)
}

// Metadata management
function getCacheMetadata(): CacheMetadata {
  if (!isLocalStorageAvailable()) return { tripIds: [], lastUpdated: 0 }

  try {
    const stored = localStorage.getItem(CACHE_METADATA_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return { tripIds: [], lastUpdated: 0 }
}

function updateCacheMetadata(tripId: string): void {
  if (!isLocalStorageAvailable()) return

  const metadata = getCacheMetadata()
  if (!metadata.tripIds.includes(tripId)) {
    metadata.tripIds.push(tripId)
  }
  metadata.lastUpdated = Date.now()

  try {
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata))
  } catch {
    // Ignore storage errors
  }
}

// Trip data caching
export function cacheTripData(tripId: string, data: CachedTripData): void {
  setCache(getTripKey(tripId), data)
  updateCacheMetadata(tripId)
}

export function getCachedTripData(tripId: string): CachedTripData | null {
  return getCache<CachedTripData>(getTripKey(tripId))
}

// City data caching
export function cacheCityData(cityId: string, data: CachedCityData): void {
  setCache(getCityKey(cityId), data)
}

export function getCachedCityData(cityId: string): CachedCityData | null {
  return getCache<CachedCityData>(getCityKey(cityId))
}

// Time blocks caching
export function cacheTimeBlocks(tripId: string, versionId: string, blocks: TimeBlock[]): void {
  const data: CachedTimeBlocks = { blocks, versionId }
  setCache(getTimeBlocksKey(tripId, versionId), data)
}

export function getCachedTimeBlocks(tripId: string, versionId: string): TimeBlock[] | null {
  const cached = getCache<CachedTimeBlocks>(getTimeBlocksKey(tripId, versionId))
  return cached?.blocks || null
}

// Plan versions caching
export function cacheAllVersions(tripId: string, versions: PlanVersion[]): void {
  setCache(getAllVersionsKey(tripId), versions)
}

export function getCachedAllVersions(tripId: string): PlanVersion[] | null {
  return getCache<PlanVersion[]>(getAllVersionsKey(tripId))
}

// Cache cleanup utilities
export function clearExpiredCache(): void {
  if (!isLocalStorageAvailable()) return

  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_PREFIX)) {
      try {
        const stored = localStorage.getItem(key)
        if (stored) {
          const entry = JSON.parse(stored)
          if (entry.expiresAt && Date.now() > entry.expiresAt) {
            keysToRemove.push(key)
          }
        }
      } catch {
        // If we can't parse it, consider it invalid and remove
        keysToRemove.push(key)
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
}

export function clearTripCache(tripId: string): void {
  if (!isLocalStorageAvailable()) return

  // Remove trip data
  removeCache(getTripKey(tripId))

  // Remove all related keys
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.includes(tripId) && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))

  // Update metadata
  const metadata = getCacheMetadata()
  metadata.tripIds = metadata.tripIds.filter(id => id !== tripId)
  try {
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata))
  } catch {
    // Ignore
  }
}

export function clearAllCache(): void {
  if (!isLocalStorageAvailable()) return

  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

// Get list of cached trips
export function getCachedTripIds(): string[] {
  return getCacheMetadata().tripIds
}

// Check if a specific trip is cached
export function isTripCached(tripId: string): boolean {
  return getCachedTripData(tripId) !== null
}

// Get cache statistics
export interface CacheStats {
  totalEntries: number
  totalSizeBytes: number
  tripCount: number
  lastUpdated: number
}

export function getCacheStats(): CacheStats {
  if (!isLocalStorageAvailable()) {
    return { totalEntries: 0, totalSizeBytes: 0, tripCount: 0, lastUpdated: 0 }
  }

  let totalEntries = 0
  let totalSizeBytes = 0

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_PREFIX)) {
      totalEntries++
      const value = localStorage.getItem(key)
      if (value) {
        totalSizeBytes += key.length + value.length
      }
    }
  }

  const metadata = getCacheMetadata()

  return {
    totalEntries,
    totalSizeBytes,
    tripCount: metadata.tripIds.length,
    lastUpdated: metadata.lastUpdated,
  }
}
