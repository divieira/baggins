-- Multi-city support migration
-- This adds support for trips with multiple cities, each with its own hotel and suggestions

-- Create trip_cities table to hold city information
CREATE TABLE trip_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add city_id to hotels (optional, for backward compatibility)
ALTER TABLE hotels ADD COLUMN city_id UUID REFERENCES trip_cities(id) ON DELETE SET NULL;

-- Add city_id to attractions
ALTER TABLE attractions ADD COLUMN city_id UUID REFERENCES trip_cities(id) ON DELETE CASCADE;

-- Add city_id to restaurants
ALTER TABLE restaurants ADD COLUMN city_id UUID REFERENCES trip_cities(id) ON DELETE CASCADE;

-- Add city_id to time_blocks
ALTER TABLE time_blocks ADD COLUMN city_id UUID REFERENCES trip_cities(id) ON DELETE CASCADE;

-- Enable RLS on trip_cities
ALTER TABLE trip_cities ENABLE ROW LEVEL SECURITY;

-- RLS policies for trip_cities
CREATE POLICY "Users can view trip cities" ON trip_cities
  FOR SELECT USING (has_trip_access(trip_id));

CREATE POLICY "Users can insert trip cities" ON trip_cities
  FOR INSERT WITH CHECK (has_trip_access(trip_id));

CREATE POLICY "Users can update trip cities" ON trip_cities
  FOR UPDATE USING (has_trip_access(trip_id));

CREATE POLICY "Users can delete trip cities" ON trip_cities
  FOR DELETE USING (has_trip_access(trip_id));

-- Indexes for performance
CREATE INDEX idx_trip_cities_trip_id ON trip_cities(trip_id);
CREATE INDEX idx_hotels_city_id ON hotels(city_id);
CREATE INDEX idx_attractions_city_id ON attractions(city_id);
CREATE INDEX idx_restaurants_city_id ON restaurants(city_id);
CREATE INDEX idx_time_blocks_city_id ON time_blocks(city_id);

-- Trigger for updated_at on trip_cities
CREATE TRIGGER update_trip_cities_updated_at BEFORE UPDATE ON trip_cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
