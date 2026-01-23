export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
      }
      trips: {
        Row: {
          id: string
          user_id: string
          destination: string
          start_date: string
          end_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          destination: string
          start_date: string
          end_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          destination?: string
          start_date?: string
          end_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      trip_collaborators: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          user_id: string
          role?: 'owner' | 'editor' | 'viewer'
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          user_id?: string
          role?: 'owner' | 'editor' | 'viewer'
          created_at?: string
        }
      }
      travelers: {
        Row: {
          id: string
          trip_id: string
          name: string
          age: number | null
          relationship: string | null
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          name: string
          age?: number | null
          relationship?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          name?: string
          age?: number | null
          relationship?: string | null
          created_at?: string
        }
      }
      flights: {
        Row: {
          id: string
          trip_id: string
          date: string
          departure_airport: string
          arrival_airport: string
          departure_time: string
          arrival_time: string
          flight_number: string | null
          airline: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          date: string
          departure_airport: string
          arrival_airport: string
          departure_time: string
          arrival_time: string
          flight_number?: string | null
          airline?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          date?: string
          departure_airport?: string
          arrival_airport?: string
          departure_time?: string
          arrival_time?: string
          flight_number?: string | null
          airline?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      hotels: {
        Row: {
          id: string
          trip_id: string
          city_id: string | null
          name: string
          address: string
          check_in_date: string
          check_out_date: string
          latitude: number | null
          longitude: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          city_id?: string | null
          name: string
          address: string
          check_in_date: string
          check_out_date: string
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          city_id?: string | null
          name?: string
          address?: string
          check_in_date?: string
          check_out_date?: string
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      attractions: {
        Row: {
          id: string
          trip_id: string
          city_id: string | null
          name: string
          description: string
          image_url: string | null
          highlights: string[]
          latitude: number
          longitude: number
          opening_time: string | null
          closing_time: string | null
          duration_minutes: number | null
          category: string
          is_kid_friendly: boolean
          min_age: number | null
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          city_id?: string | null
          name: string
          description: string
          image_url?: string | null
          highlights?: string[]
          latitude: number
          longitude: number
          opening_time?: string | null
          closing_time?: string | null
          duration_minutes?: number | null
          category?: string
          is_kid_friendly?: boolean
          min_age?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          city_id?: string | null
          name?: string
          description?: string
          image_url?: string | null
          highlights?: string[]
          latitude?: number
          longitude?: number
          opening_time?: string | null
          closing_time?: string | null
          duration_minutes?: number | null
          category?: string
          is_kid_friendly?: boolean
          min_age?: number | null
          created_at?: string
        }
      }
      restaurants: {
        Row: {
          id: string
          trip_id: string
          city_id: string | null
          name: string
          description: string
          image_url: string | null
          highlights: string[]
          latitude: number
          longitude: number
          opening_time: string | null
          closing_time: string | null
          cuisine_type: string
          price_level: number
          is_kid_friendly: boolean
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          city_id?: string | null
          name: string
          description: string
          image_url?: string | null
          highlights?: string[]
          latitude: number
          longitude: number
          opening_time?: string | null
          closing_time?: string | null
          cuisine_type?: string
          price_level?: number
          is_kid_friendly?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          city_id?: string | null
          name?: string
          description?: string
          image_url?: string | null
          highlights?: string[]
          latitude?: number
          longitude?: number
          opening_time?: string | null
          closing_time?: string | null
          cuisine_type?: string
          price_level?: number
          is_kid_friendly?: boolean
          created_at?: string
        }
      }
      plan_versions: {
        Row: {
          id: string
          trip_id: string
          version_number: number
          plan_data: Json
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          version_number: number
          plan_data: Json
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          version_number?: number
          plan_data?: Json
          created_by?: string
          created_at?: string
        }
      }
      time_blocks: {
        Row: {
          id: string
          trip_id: string
          city_id: string | null
          plan_version_id: string
          date: string
          block_type: 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening'
          start_time: string
          end_time: string
          selected_attraction_id: string | null
          selected_restaurant_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          city_id?: string | null
          plan_version_id: string
          date: string
          block_type: 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening'
          start_time: string
          end_time: string
          selected_attraction_id?: string | null
          selected_restaurant_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          city_id?: string | null
          plan_version_id?: string
          date?: string
          block_type?: 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening'
          start_time?: string
          end_time?: string
          selected_attraction_id?: string | null
          selected_restaurant_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trip_cities: {
        Row: {
          id: string
          trip_id: string
          name: string
          start_date: string
          end_date: string
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          name: string
          start_date: string
          end_date: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          name?: string
          start_date?: string
          end_date?: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      ai_interactions: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          message: string
          response: string
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          user_id: string
          message: string
          response: string
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          user_id?: string
          message?: string
          response?: string
          created_at?: string
        }
      }
    }
  }
}
