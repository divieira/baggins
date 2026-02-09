import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/client";
import { buildChatPrompt } from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { trip_id, message } = await request.json();

    if (!trip_id || !message) {
      return NextResponse.json({ error: "trip_id and message are required" }, { status: 400 });
    }

    // Get trip data
    const { data: trip } = await supabase
      .from("trips")
      .select("*")
      .eq("id", trip_id)
      .single();

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const { data: travelers } = await supabase
      .from("travelers")
      .select("name, age")
      .eq("trip_id", trip_id);

    const { data: cities } = await supabase
      .from("cities")
      .select("name, country")
      .eq("trip_id", trip_id);

    // Get recent chat history
    const { data: recentHistory } = await supabase
      .from("ai_interactions")
      .select("message, response")
      .eq("trip_id", trip_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const prompt = buildChatPrompt(
      message,
      trip.destination,
      { start: trip.start_date, end: trip.end_date },
      travelers || [],
      cities || [],
      (recentHistory || []).reverse()
    );

    const response = await callClaude(
      "You are a helpful travel planning assistant. Be concise and practical.",
      prompt
    );

    // Store interaction
    await supabase.from("ai_interactions").insert({
      trip_id,
      user_id: user.id,
      message,
      response,
    });

    return NextResponse.json({ response });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
