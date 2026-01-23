-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip collaborators for sharing
CREATE TABLE trip_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Travelers (family members, etc.)
CREATE TABLE travelers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  relationship TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flights
CREATE TABLE flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  departure_airport TEXT NOT NULL,
  arrival_airport TEXT NOT NULL,
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  flight_number TEXT,
  airline TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hotels
CREATE TABLE hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attractions pool
CREATE TABLE attractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  highlights TEXT[] DEFAULT '{}',
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  opening_time TIME,
  closing_time TIME,
  duration_minutes INTEGER,
  category TEXT NOT NULL DEFAULT 'general',
  is_kid_friendly BOOLEAN DEFAULT false,
  min_age INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restaurants pool
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  highlights TEXT[] DEFAULT '{}',
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  opening_time TIME,
  closing_time TIME,
  cuisine_type TEXT NOT NULL DEFAULT 'general',
  price_level INTEGER DEFAULT 2 CHECK (price_level BETWEEN 1 AND 4),
  is_kid_friendly BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan versions for rollback
CREATE TABLE plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  plan_data JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, version_number)
);

-- Time blocks for daily planning
CREATE TABLE time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('morning', 'lunch', 'afternoon', 'dinner', 'evening')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  selected_attraction_id UUID REFERENCES attractions(id) ON DELETE SET NULL,
  selected_restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI chat interactions
CREATE TABLE ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE travelers ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

-- Users: Can only view their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Trips: Can view if owner or collaborator
CREATE POLICY "Users can view own trips" ON trips
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM trip_collaborators
      WHERE trip_collaborators.trip_id = trips.id
      AND trip_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trips" ON trips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips" ON trips
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM trip_collaborators
      WHERE trip_collaborators.trip_id = trips.id
      AND trip_collaborators.user_id = auth.uid()
      AND trip_collaborators.role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Users can delete own trips" ON trips
  FOR DELETE USING (auth.uid() = user_id);

-- Trip collaborators
CREATE POLICY "Users can view trip collaborators" ON trip_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_collaborators.trip_id
      AND (trips.user_id = auth.uid() OR trip_collaborators.user_id = auth.uid())
    )
  );

CREATE POLICY "Trip owners can manage collaborators" ON trip_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_collaborators.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- Helper function to check trip access
CREATE OR REPLACE FUNCTION has_trip_access(trip_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trips
    WHERE id = trip_id_param
    AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM trip_collaborators
        WHERE trip_collaborators.trip_id = trip_id_param
        AND trip_collaborators.user_id = auth.uid()
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply access policies to related tables
CREATE POLICY "Users can view trip travelers" ON travelers
  FOR SELECT USING (has_trip_access(trip_id));

CREATE POLICY "Users can manage trip travelers" ON travelers
  FOR ALL USING (has_trip_access(trip_id));

CREATE POLICY "Users can view trip flights" ON flights
  FOR SELECT USING (has_trip_access(trip_id));

CREATE POLICY "Users can manage trip flights" ON flights
  FOR ALL USING (has_trip_access(trip_id));

CREATE POLICY "Users can view trip hotels" ON hotels
  FOR SELECT USING (has_trip_access(trip_id));

CREATE POLICY "Users can manage trip hotels" ON hotels
  FOR ALL USING (has_trip_access(trip_id));

CREATE POLICY "Users can view trip attractions" ON attractions
  FOR SELECT USING (has_trip_access(trip_id));

CREATE POLICY "Users can manage trip attractions" ON attractions
  FOR ALL USING (has_trip_access(trip_id));

CREATE POLICY "Users can view trip restaurants" ON restaurants
  FOR SELECT USING (has_trip_access(trip_id));

CREATE POLICY "Users can manage trip restaurants" ON restaurants
  FOR ALL USING (has_trip_access(trip_id));

CREATE POLICY "Users can view plan versions" ON plan_versions
  FOR SELECT USING (has_trip_access(trip_id));

CREATE POLICY "Users can create plan versions" ON plan_versions
  FOR INSERT WITH CHECK (has_trip_access(trip_id));

CREATE POLICY "Users can view time blocks" ON time_blocks
  FOR SELECT USING (has_trip_access(trip_id));

CREATE POLICY "Users can manage time blocks" ON time_blocks
  FOR ALL USING (has_trip_access(trip_id));

CREATE POLICY "Users can view AI interactions" ON ai_interactions
  FOR SELECT USING (has_trip_access(trip_id));

CREATE POLICY "Users can create AI interactions" ON ai_interactions
  FOR INSERT WITH CHECK (has_trip_access(trip_id) AND auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trip_collaborators_trip_id ON trip_collaborators(trip_id);
CREATE INDEX idx_trip_collaborators_user_id ON trip_collaborators(user_id);
CREATE INDEX idx_travelers_trip_id ON travelers(trip_id);
CREATE INDEX idx_flights_trip_id ON flights(trip_id);
CREATE INDEX idx_hotels_trip_id ON hotels(trip_id);
CREATE INDEX idx_attractions_trip_id ON attractions(trip_id);
CREATE INDEX idx_restaurants_trip_id ON restaurants(trip_id);
CREATE INDEX idx_plan_versions_trip_id ON plan_versions(trip_id);
CREATE INDEX idx_time_blocks_trip_id ON time_blocks(trip_id);
CREATE INDEX idx_time_blocks_plan_version_id ON time_blocks(plan_version_id);
CREATE INDEX idx_ai_interactions_trip_id ON ai_interactions(trip_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flights_updated_at BEFORE UPDATE ON flights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotels_updated_at BEFORE UPDATE ON hotels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_blocks_updated_at BEFORE UPDATE ON time_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
