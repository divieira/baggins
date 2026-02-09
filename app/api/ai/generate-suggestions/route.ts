import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { buildSuggestionsPrompt } from "@/lib/ai/prompts";

interface SuggestionAttraction {
  name: string;
  description: string;
  highlights: string[];
  latitude: number;
  longitude: number;
  opening_time: string | null;
  closing_time: string | null;
  duration_minutes: number;
  category: string;
  is_kid_friendly: boolean;
  min_age: number | null;
}

interface SuggestionRestaurant {
  name: string;
  description: string;
  highlights: string[];
  latitude: number;
  longitude: number;
  opening_time: string | null;
  closing_time: string | null;
  cuisine_type: string;
  price_level: number;
  is_kid_friendly: boolean;
}

interface SuggestionsResponse {
  attractions: SuggestionAttraction[];
  restaurants: SuggestionRestaurant[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { trip_id, city_id } = await request.json();

    if (!trip_id || !city_id) {
      return NextResponse.json({ error: "trip_id and city_id are required" }, { status: 400 });
    }

    // Verify access
    const { data: trip } = await supabase
      .from("trips")
      .select("*")
      .eq("id", trip_id)
      .single();

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const { data: city } = await supabase
      .from("cities")
      .select("*")
      .eq("id", city_id)
      .single();

    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    const { data: travelers } = await supabase
      .from("travelers")
      .select("name, age")
      .eq("trip_id", trip_id);

    // Generate suggestions
    const prompt = buildSuggestionsPrompt(
      city.name,
      city.country,
      travelers || []
    );
    const responseText = await callClaude(
      "You are a travel expert. Provide accurate, real location data.",
      prompt
    );
    const suggestions = parseJsonResponse<SuggestionsResponse>(responseText);

    // Check for duplicates in names
    const attractionNames = new Set<string>();
    const uniqueAttractions = suggestions.attractions.filter((a) => {
      if (attractionNames.has(a.name)) return false;
      attractionNames.add(a.name);
      return true;
    });

    const restaurantNames = new Set<string>();
    const uniqueRestaurants = suggestions.restaurants.filter((r) => {
      if (restaurantNames.has(r.name)) return false;
      restaurantNames.add(r.name);
      return true;
    });

    // Insert attractions
    const { data: insertedAttractions } = await supabase
      .from("attractions")
      .insert(
        uniqueAttractions.map((a) => ({
          trip_id,
          city_id,
          name: a.name,
          description: a.description,
          highlights: a.highlights,
          latitude: a.latitude,
          longitude: a.longitude,
          opening_time: a.opening_time,
          closing_time: a.closing_time,
          duration_minutes: a.duration_minutes,
          category: a.category,
          is_kid_friendly: a.is_kid_friendly,
          min_age: a.min_age,
        }))
      )
      .select();

    // Insert restaurants
    const { data: insertedRestaurants } = await supabase
      .from("restaurants")
      .insert(
        uniqueRestaurants.map((r) => ({
          trip_id,
          city_id,
          name: r.name,
          description: r.description,
          highlights: r.highlights,
          latitude: r.latitude,
          longitude: r.longitude,
          opening_time: r.opening_time,
          closing_time: r.closing_time,
          cuisine_type: r.cuisine_type,
          price_level: r.price_level,
          is_kid_friendly: r.is_kid_friendly,
        }))
      )
      .select();

    return NextResponse.json({
      attractions: insertedAttractions,
      restaurants: insertedRestaurants,
      counts: {
        attractions: insertedAttractions?.length || 0,
        restaurants: insertedRestaurants?.length || 0,
      },
    });
  } catch (err) {
    console.error("Generate suggestions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
