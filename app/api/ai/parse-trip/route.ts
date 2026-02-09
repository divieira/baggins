import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { PARSE_TRIP_PROMPT } from "@/lib/ai/prompts";

interface ParsedCity {
  name: string;
  country: string | null;
  start_date: string;
  end_date: string;
  city_order: number;
  latitude: number | null;
  longitude: number | null;
}

interface ParsedTraveler {
  name: string;
  age: number | null;
  relationship: string | null;
}

interface ParsedFlight {
  date: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  flight_number: string | null;
  airline: string | null;
}

interface ParsedHotel {
  name: string;
  address: string;
  check_in_date: string;
  check_out_date: string;
  latitude: number | null;
  longitude: number | null;
  city_name: string;
}

interface ParsedTrip {
  error: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  cities: ParsedCity[];
  travelers: ParsedTraveler[];
  flights: ParsedFlight[];
  hotels: ParsedHotel[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Parse trip with AI
    const responseText = await callClaude(PARSE_TRIP_PROMPT, message);
    const parsed = parseJsonResponse<ParsedTrip>(responseText);

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (!parsed.cities || parsed.cities.length === 0) {
      return NextResponse.json({ error: "Could not identify any destination cities." }, { status: 400 });
    }

    // Ensure user profile exists
    await supabase.from("users").upsert({ id: user.id, email: user.email });

    // Create trip
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        destination: parsed.destination,
        start_date: parsed.start_date,
        end_date: parsed.end_date,
      })
      .select()
      .single();

    if (tripError) {
      return NextResponse.json({ error: "Failed to create trip: " + tripError.message }, { status: 500 });
    }

    // Create cities
    const citiesInsert = parsed.cities.map((c) => ({
      trip_id: trip.id,
      name: c.name,
      country: c.country,
      start_date: c.start_date,
      end_date: c.end_date,
      city_order: c.city_order,
      latitude: c.latitude,
      longitude: c.longitude,
    }));

    const { data: cities, error: citiesError } = await supabase
      .from("cities")
      .insert(citiesInsert)
      .select();

    if (citiesError) {
      return NextResponse.json({ error: "Failed to create cities: " + citiesError.message }, { status: 500 });
    }

    // Create travelers
    if (parsed.travelers && parsed.travelers.length > 0) {
      await supabase.from("travelers").insert(
        parsed.travelers.map((t) => ({
          trip_id: trip.id,
          name: t.name,
          age: t.age,
          relationship: t.relationship,
        }))
      );
    }

    // Create flights
    if (parsed.flights && parsed.flights.length > 0) {
      await supabase.from("flights").insert(
        parsed.flights.map((f) => ({
          trip_id: trip.id,
          date: f.date,
          departure_airport: f.departure_airport,
          arrival_airport: f.arrival_airport,
          departure_time: f.departure_time,
          arrival_time: f.arrival_time,
          flight_number: f.flight_number,
          airline: f.airline,
        }))
      );
    }

    // Create hotels (link to cities)
    if (parsed.hotels && parsed.hotels.length > 0) {
      const cityMap = new Map(cities!.map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id]));
      await supabase.from("hotels").insert(
        parsed.hotels.map((h) => ({
          trip_id: trip.id,
          city_id: cityMap.get(h.city_name.toLowerCase()) || null,
          name: h.name,
          address: h.address,
          check_in_date: h.check_in_date,
          check_out_date: h.check_out_date,
          latitude: h.latitude,
          longitude: h.longitude,
        }))
      );
    }

    return NextResponse.json({
      trip_id: trip.id,
      destination: trip.destination,
      cities: cities,
      message: `Trip to ${trip.destination} created with ${cities!.length} city/cities.`,
    });
  } catch (err) {
    console.error("Parse trip error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse trip" },
      { status: 500 }
    );
  }
}
