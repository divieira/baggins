import { Database } from './database'

export type Trip = Database['public']['Tables']['trips']['Row']
export type TripInsert = Database['public']['Tables']['trips']['Insert']
export type TripUpdate = Database['public']['Tables']['trips']['Update']

export type Traveler = Database['public']['Tables']['travelers']['Row']
export type TravelerInsert = Database['public']['Tables']['travelers']['Insert']

export type Flight = Database['public']['Tables']['flights']['Row']
export type FlightInsert = Database['public']['Tables']['flights']['Insert']

export type Hotel = Database['public']['Tables']['hotels']['Row']
export type HotelInsert = Database['public']['Tables']['hotels']['Insert']

export type Attraction = Database['public']['Tables']['attractions']['Row']
export type AttractionInsert = Database['public']['Tables']['attractions']['Insert']

export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type RestaurantInsert = Database['public']['Tables']['restaurants']['Insert']

export type PlanVersion = Database['public']['Tables']['plan_versions']['Row']
export type PlanVersionInsert = Database['public']['Tables']['plan_versions']['Insert']

export type TimeBlock = Database['public']['Tables']['time_blocks']['Row']
export type TimeBlockInsert = Database['public']['Tables']['time_blocks']['Insert']
export type TimeBlockUpdate = Database['public']['Tables']['time_blocks']['Update']

export type BlockType = 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening'

export interface TimeBlockWithDetails extends TimeBlock {
  attraction?: Attraction | null
  restaurant?: Restaurant | null
  suggestions?: {
    attractions: AttractionSuggestion[]
    restaurants: RestaurantSuggestion[]
  }
}

export interface AttractionSuggestion extends Attraction {
  distance_km: number
  travel_time_minutes: number
  is_available: boolean
}

export interface RestaurantSuggestion extends Restaurant {
  distance_km: number
  travel_time_minutes: number
  is_available: boolean
}

export interface DayPlan {
  date: string
  flights: Flight[]
  hotel: Hotel | null
  timeBlocks: TimeBlockWithDetails[]
}

export interface TripWithDetails extends Trip {
  travelers: Traveler[]
  flights: Flight[]
  hotels: Hotel[]
  currentVersion?: PlanVersion
  dayPlans?: DayPlan[]
}
