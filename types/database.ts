export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: string;
  trip_id: string;
  name: string;
  country: string | null;
  start_date: string;
  end_date: string;
  city_order: number;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Traveler {
  id: string;
  trip_id: string;
  name: string;
  age: number | null;
  relationship: string | null;
  created_at: string;
}

export interface Flight {
  id: string;
  trip_id: string;
  date: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  flight_number: string | null;
  airline: string | null;
  created_at: string;
  updated_at: string;
}

export interface Hotel {
  id: string;
  trip_id: string;
  city_id: string | null;
  name: string;
  address: string;
  check_in_date: string;
  check_out_date: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface Attraction {
  id: string;
  trip_id: string;
  city_id: string;
  name: string;
  description: string;
  image_url: string | null;
  highlights: string[];
  latitude: number;
  longitude: number;
  opening_time: string | null;
  closing_time: string | null;
  duration_minutes: number | null;
  category: string;
  is_kid_friendly: boolean;
  min_age: number | null;
  created_at: string;
}

export interface Restaurant {
  id: string;
  trip_id: string;
  city_id: string;
  name: string;
  description: string;
  image_url: string | null;
  highlights: string[];
  latitude: number;
  longitude: number;
  opening_time: string | null;
  closing_time: string | null;
  cuisine_type: string;
  price_level: number;
  is_kid_friendly: boolean;
  created_at: string;
}

export interface PlanVersion {
  id: string;
  trip_id: string;
  city_id: string | null;
  version_number: number;
  summary: string | null;
  plan_data: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export type BlockType = "morning" | "lunch" | "afternoon" | "dinner" | "evening";

export interface TimeBlock {
  id: string;
  trip_id: string;
  city_id: string;
  plan_version_id: string;
  date: string;
  block_type: BlockType;
  start_time: string;
  end_time: string;
  selected_attraction_id: string | null;
  selected_restaurant_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  attraction?: Attraction | null;
  restaurant?: Restaurant | null;
}

export interface AiInteraction {
  id: string;
  trip_id: string;
  user_id: string;
  message: string;
  response: string;
  created_at: string;
}

export interface TripWithDetails extends Trip {
  cities: City[];
  travelers: Traveler[];
  flights: Flight[];
  hotels: Hotel[];
}
