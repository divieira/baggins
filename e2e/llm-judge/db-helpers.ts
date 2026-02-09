/**
 * Database access abstraction for E2E tests.
 *
 * All Supabase queries use table/column names from app-config.ts, so
 * schema changes only need updating in one place.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DB } from './app-config';
import { AttractionData, RestaurantData, TimeBlockData } from './types';

const { tables: T, columns: C } = DB;

// ─── Client Creation ────────────────────────────────────────────────────────

export function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

export interface TripData {
  trip: any;
  cities: any[] | null;
  travelers: any[] | null;
  attractions: any[] | null;
  restaurants: any[] | null;
  timeBlocks: any[] | null;
  planVersions: any[] | null;
}

export async function fetchTripData(
  supabase: SupabaseClient,
  tripId: string
): Promise<TripData> {
  const [
    { data: trip },
    { data: cities },
    { data: travelers },
    { data: attractions },
    { data: restaurants },
    { data: timeBlocks },
    { data: planVersions },
  ] = await Promise.all([
    supabase.from(T.trips).select('*').eq(C.id, tripId).single(),
    supabase.from(T.cities).select('*').eq(C.tripId, tripId).order(C.orderIndex),
    supabase.from(T.travelers).select('*').eq(C.tripId, tripId),
    supabase.from(T.attractions).select('*').eq(C.tripId, tripId),
    supabase.from(T.restaurants).select('*').eq(C.tripId, tripId),
    supabase.from(T.timeBlocks).select('*').eq(C.tripId, tripId).order(C.date).order(C.startTime),
    supabase.from(T.planVersions).select('*').eq(C.tripId, tripId).order(C.versionNumber, { ascending: false }),
  ]);

  return { trip, cities, travelers, attractions, restaurants, timeBlocks, planVersions };
}

/**
 * Get time blocks that belong to a specific plan version.
 */
export function getBlocksForVersion(allBlocks: any[], versionId: string): any[] {
  return allBlocks.filter(b => b[C.planVersionId] === versionId);
}

// ─── Data Conversion ────────────────────────────────────────────────────────
// Convert raw DB rows to the judge-agnostic types.

export function toAttractionData(dbAttractions: any[]): AttractionData[] {
  return dbAttractions.map(a => ({
    name: a[C.name],
    description: a[C.description] || '',
    category: a[C.category] || 'general',
    latitude: a[C.latitude],
    longitude: a[C.longitude],
    opening_time: a[C.openingTime],
    closing_time: a[C.closingTime],
    duration_minutes: a[C.durationMinutes],
    is_kid_friendly: a[C.isKidFriendly] || false,
    min_age: a[C.minAge],
    highlights: a[C.highlights] || [],
  }));
}

export function toRestaurantData(dbRestaurants: any[]): RestaurantData[] {
  return dbRestaurants.map(r => ({
    name: r[C.name],
    description: r[C.description] || '',
    cuisine_type: r[C.cuisineType] || '',
    latitude: r[C.latitude],
    longitude: r[C.longitude],
    opening_time: r[C.openingTime],
    closing_time: r[C.closingTime],
    price_level: r[C.priceLevel] || 2,
    is_kid_friendly: r[C.isKidFriendly] || false,
    highlights: r[C.highlights] || [],
  }));
}

export function toTimeBlockData(
  dbBlocks: any[],
  dbAttractions: any[],
  dbRestaurants: any[]
): TimeBlockData[] {
  const attrMap = new Map(dbAttractions.map(a => [a[C.id], a[C.name]]));
  const restMap = new Map(dbRestaurants.map(r => [r[C.id], r[C.name]]));

  return dbBlocks.map(b => ({
    date: b[C.date],
    block_type: b[C.blockType],
    start_time: b[C.startTime],
    end_time: b[C.endTime],
    attraction_name: b[C.selectedAttractionId]
      ? attrMap.get(b[C.selectedAttractionId]) || null
      : null,
    restaurant_name: b[C.selectedRestaurantId]
      ? restMap.get(b[C.selectedRestaurantId]) || null
      : null,
  }));
}
