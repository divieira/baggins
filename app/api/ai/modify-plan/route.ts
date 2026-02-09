import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { buildModifyPlanPrompt } from "@/lib/ai/prompts";

interface ModifyChange {
  block_id: string;
  attraction_id: string | null;
  restaurant_id: string | null;
}

interface ModifyResponse {
  summary: string;
  changes: ModifyChange[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { trip_id, city_id, request: modRequest } = await request.json();

    if (!trip_id || !city_id || !modRequest) {
      return NextResponse.json(
        { error: "trip_id, city_id, and request are required" },
        { status: 400 }
      );
    }

    const { data: city } = await supabase
      .from("cities")
      .select("*")
      .eq("id", city_id)
      .single();

    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    // Get current latest version for this city
    const { data: latestVersion } = await supabase
      .from("plan_versions")
      .select("*")
      .eq("trip_id", trip_id)
      .eq("city_id", city_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    if (!latestVersion) {
      return NextResponse.json({ error: "No existing plan found for this city" }, { status: 404 });
    }

    // Get current time blocks
    const { data: currentBlocks } = await supabase
      .from("time_blocks")
      .select(`
        id, date, block_type, selected_attraction_id, selected_restaurant_id,
        attractions:selected_attraction_id(name),
        restaurants:selected_restaurant_id(name)
      `)
      .eq("plan_version_id", latestVersion.id)
      .order("date")
      .order("start_time");

    // Get available attractions and restaurants for this city
    const { data: attractions } = await supabase
      .from("attractions")
      .select("id, name, category, is_kid_friendly, city_id")
      .eq("trip_id", trip_id);

    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id, name, cuisine_type, is_kid_friendly, city_id")
      .eq("trip_id", trip_id);

    const blocksForPrompt = (currentBlocks || []).map((b) => ({
      id: b.id,
      date: b.date,
      block_type: b.block_type,
      attraction_id: b.selected_attraction_id,
      attraction_name: (b.attractions as unknown as { name: string } | null)?.name || null,
      restaurant_id: b.selected_restaurant_id,
      restaurant_name: (b.restaurants as unknown as { name: string } | null)?.name || null,
    }));

    const prompt = buildModifyPlanPrompt(
      modRequest,
      city.name,
      blocksForPrompt,
      attractions || [],
      restaurants || [],
      city_id
    );

    const responseText = await callClaude(
      "You are a travel plan modification assistant. Only change what is requested.",
      prompt
    );
    const modification = parseJsonResponse<ModifyResponse>(responseText);

    if (!modification.changes || modification.changes.length === 0) {
      return NextResponse.json({
        summary: modification.summary || "No changes needed.",
        changes: [],
        version: latestVersion.version_number,
      });
    }

    // Validate changes: attractions/restaurants must belong to this city
    const cityAttractionIds = new Set(
      (attractions || []).filter((a) => a.city_id === city_id).map((a) => a.id)
    );
    const cityRestaurantIds = new Set(
      (restaurants || []).filter((r) => r.city_id === city_id).map((r) => r.id)
    );
    const blockIds = new Set((currentBlocks || []).map((b) => b.id));

    for (const change of modification.changes) {
      if (!blockIds.has(change.block_id)) {
        return NextResponse.json({ error: `Invalid block ID: ${change.block_id}` }, { status: 400 });
      }
      if (change.attraction_id && !cityAttractionIds.has(change.attraction_id)) {
        return NextResponse.json(
          { error: `Attraction ${change.attraction_id} does not belong to ${city.name}` },
          { status: 400 }
        );
      }
      if (change.restaurant_id && !cityRestaurantIds.has(change.restaurant_id)) {
        return NextResponse.json(
          { error: `Restaurant ${change.restaurant_id} does not belong to ${city.name}` },
          { status: 400 }
        );
      }
    }

    // Create new version by copying existing blocks and applying changes
    const nextVersion = latestVersion.version_number + 1;

    const { data: newPlanVersion, error: versionError } = await supabase
      .from("plan_versions")
      .insert({
        trip_id,
        city_id,
        version_number: nextVersion,
        summary: modification.summary,
        plan_data: modification,
        created_by: user.id,
      })
      .select()
      .single();

    if (versionError) {
      return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
    }

    // Copy all blocks from previous version, applying changes
    const changesMap = new Map(modification.changes.map((c) => [c.block_id, c]));

    const newBlocks = (currentBlocks || []).map((block) => {
      const change = changesMap.get(block.id);
      return {
        trip_id,
        city_id,
        plan_version_id: newPlanVersion.id,
        date: block.date,
        block_type: block.block_type,
        start_time: "09:00", // Default, will be set properly below
        end_time: "12:00",
        selected_attraction_id: change ? change.attraction_id : block.selected_attraction_id,
        selected_restaurant_id: change ? change.restaurant_id : block.selected_restaurant_id,
      };
    });

    // Set proper times based on block type
    const blockTimes: Record<string, { start: string; end: string }> = {
      morning: { start: "09:00", end: "12:00" },
      lunch: { start: "12:00", end: "13:30" },
      afternoon: { start: "13:30", end: "17:00" },
      dinner: { start: "18:00", end: "20:00" },
      evening: { start: "20:00", end: "22:00" },
    };

    for (const block of newBlocks) {
      const times = blockTimes[block.block_type];
      if (times) {
        block.start_time = times.start;
        block.end_time = times.end;
      }
    }

    const { data: insertedBlocks } = await supabase
      .from("time_blocks")
      .insert(newBlocks)
      .select();

    return NextResponse.json({
      plan_version: newPlanVersion,
      time_blocks: insertedBlocks,
      summary: modification.summary,
      changes_count: modification.changes.length,
    });
  } catch (err) {
    console.error("Modify plan error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to modify plan" },
      { status: 500 }
    );
  }
}
