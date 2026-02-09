import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { buildItineraryPrompt } from "@/lib/ai/prompts";

interface ItineraryBlock {
  block_type: string;
  start_time: string;
  end_time: string;
  attraction_id: string | null;
  restaurant_id: string | null;
}

interface ItineraryDay {
  date: string;
  blocks: ItineraryBlock[];
}

interface ItineraryResponse {
  summary: string;
  days: ItineraryDay[];
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

    const { data: city } = await supabase
      .from("cities")
      .select("*")
      .eq("id", city_id)
      .single();

    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    // Get travelers
    const { data: travelers } = await supabase
      .from("travelers")
      .select("name, age")
      .eq("trip_id", trip_id);

    // Get attractions for this city
    const { data: attractions } = await supabase
      .from("attractions")
      .select("id, name, opening_time, closing_time, duration_minutes, is_kid_friendly, category")
      .eq("city_id", city_id);

    // Get restaurants for this city
    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id, name, opening_time, closing_time, cuisine_type, is_kid_friendly")
      .eq("city_id", city_id);

    if (!attractions?.length && !restaurants?.length) {
      return NextResponse.json(
        { error: "No suggestions found for this city. Generate suggestions first." },
        { status: 400 }
      );
    }

    // Check for arrival flight on first day
    const { data: flights } = await supabase
      .from("flights")
      .select("arrival_time, date")
      .eq("trip_id", trip_id)
      .eq("date", city.start_date);

    const arrivalTime = flights?.[0]?.arrival_time || null;

    // Generate itinerary
    const prompt = buildItineraryPrompt(
      city.name,
      city.start_date,
      city.end_date,
      attractions || [],
      restaurants || [],
      travelers || [],
      arrivalTime
    );

    const responseText = await callClaude(
      "You are an expert travel itinerary planner. Create well-organized daily schedules.",
      prompt
    );
    const itinerary = parseJsonResponse<ItineraryResponse>(responseText);

    // Validate: no attraction/restaurant assigned more than once
    const usedAttractions = new Set<string>();
    const usedRestaurants = new Set<string>();
    const attractionIds = new Set((attractions || []).map((a) => a.id));
    const restaurantIds = new Set((restaurants || []).map((r) => r.id));

    for (const day of itinerary.days) {
      for (const block of day.blocks) {
        if (block.attraction_id) {
          if (!attractionIds.has(block.attraction_id)) {
            block.attraction_id = null; // Invalid ID, clear it
          } else if (usedAttractions.has(block.attraction_id)) {
            block.attraction_id = null; // Duplicate, clear it
          } else {
            usedAttractions.add(block.attraction_id);
          }
        }
        if (block.restaurant_id) {
          if (!restaurantIds.has(block.restaurant_id)) {
            block.restaurant_id = null;
          } else if (usedRestaurants.has(block.restaurant_id)) {
            block.restaurant_id = null;
          } else {
            usedRestaurants.add(block.restaurant_id);
          }
        }
      }
    }

    // Get next version number for this city
    const { data: existingVersions } = await supabase
      .from("plan_versions")
      .select("version_number")
      .eq("trip_id", trip_id)
      .eq("city_id", city_id)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersion = (existingVersions?.[0]?.version_number || 0) + 1;

    // Create plan version
    const { data: planVersion, error: versionError } = await supabase
      .from("plan_versions")
      .insert({
        trip_id,
        city_id,
        version_number: nextVersion,
        summary: itinerary.summary,
        plan_data: itinerary,
        created_by: user.id,
      })
      .select()
      .single();

    if (versionError) {
      return NextResponse.json({ error: "Failed to create plan version: " + versionError.message }, { status: 500 });
    }

    // Create time blocks
    const timeBlocksInsert = itinerary.days.flatMap((day) =>
      day.blocks.map((block) => ({
        trip_id,
        city_id,
        plan_version_id: planVersion.id,
        date: day.date,
        block_type: block.block_type,
        start_time: block.start_time,
        end_time: block.end_time,
        selected_attraction_id: block.attraction_id,
        selected_restaurant_id: block.restaurant_id,
      }))
    );

    const { data: timeBlocks, error: blocksError } = await supabase
      .from("time_blocks")
      .insert(timeBlocksInsert)
      .select();

    if (blocksError) {
      return NextResponse.json({ error: "Failed to create time blocks: " + blocksError.message }, { status: 500 });
    }

    return NextResponse.json({
      plan_version: planVersion,
      time_blocks: timeBlocks,
      summary: itinerary.summary,
    });
  } catch (err) {
    console.error("Generate itinerary error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate itinerary" },
      { status: 500 }
    );
  }
}
