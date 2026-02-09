"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { City, PlanVersion, TimeBlock, Attraction, Restaurant } from "@/types/database";
import Timeline from "./Timeline";
import VersionNavigator from "./VersionNavigator";
import ModifyPlan from "./ModifyPlan";

interface CityItineraryProps {
  tripId: string;
  city: City;
  initialAttractions: Attraction[];
  initialRestaurants: Restaurant[];
  initialVersions: PlanVersion[];
  initialBlocks: TimeBlock[];
}

export default function CityItinerary({
  tripId,
  city,
  initialAttractions,
  initialRestaurants,
  initialVersions,
  initialBlocks,
}: CityItineraryProps) {
  const [versions, setVersions] = useState(initialVersions);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [attractions] = useState(initialAttractions);
  const [restaurants] = useState(initialRestaurants);
  const [currentVersion, setCurrentVersion] = useState(
    initialVersions.length > 0
      ? initialVersions[initialVersions.length - 1].version_number
      : 0
  );
  const [generating, setGenerating] = useState(false);
  const [suggestionsGenerated, setSuggestionsGenerated] = useState(
    initialAttractions.length > 0 || initialRestaurants.length > 0
  );
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const generateSuggestions = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, city_id: city.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setSuggestionsGenerated(true);
    } catch {
      setError("Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  const generateItinerary = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, city_id: city.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      await refreshData();
    } catch {
      setError("Failed to generate itinerary");
    } finally {
      setGenerating(false);
    }
  };

  const refreshData = useCallback(async () => {
    const { data: newVersions } = await supabase
      .from("plan_versions")
      .select("*")
      .eq("trip_id", tripId)
      .eq("city_id", city.id)
      .order("version_number");

    if (newVersions && newVersions.length > 0) {
      setVersions(newVersions);
      const latest = newVersions[newVersions.length - 1];
      setCurrentVersion(latest.version_number);

      const { data: newBlocks } = await supabase
        .from("time_blocks")
        .select("*, attractions:selected_attraction_id(*), restaurants:selected_restaurant_id(*)")
        .eq("plan_version_id", latest.id)
        .order("date")
        .order("start_time");

      if (newBlocks) {
        const mapped = newBlocks.map((b) => ({
          ...b,
          attraction: b.attractions as unknown as Attraction | null,
          restaurant: b.restaurants as unknown as Restaurant | null,
        }));
        setBlocks(mapped);
      }
    }
  }, [supabase, tripId, city.id]);

  const handleVersionChange = useCallback(async (versionId: string, versionNumber: number) => {
    setCurrentVersion(versionNumber);
    const { data: newBlocks } = await supabase
      .from("time_blocks")
      .select("*, attractions:selected_attraction_id(*), restaurants:selected_restaurant_id(*)")
      .eq("plan_version_id", versionId)
      .order("date")
      .order("start_time");

    if (newBlocks) {
      const mapped = newBlocks.map((b) => ({
        ...b,
        attraction: b.attractions as unknown as Attraction | null,
        restaurant: b.restaurants as unknown as Restaurant | null,
      }));
      setBlocks(mapped);
    }
  }, [supabase]);

  // Suppress the exhaustive-deps warning — we intentionally avoid refreshData in the dep array
  // because it would cause an infinite loop. The effect should only run once on mount.
  useEffect(() => {
    if (versions.length > 0 && blocks.length === 0) {
      refreshData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group blocks by date
  const blocksByDate = blocks.reduce<Record<string, typeof blocks>>((acc, block) => {
    if (!acc[block.date]) acc[block.date] = [];
    acc[block.date].push(block);
    return acc;
  }, {});

  const dates = Object.keys(blocksByDate).sort();

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">
            {city.name}
            {city.country && <span className="text-gray-500 font-normal">, {city.country}</span>}
          </h2>
          <p className="text-sm text-gray-500">
            {new Date(city.start_date + "T00:00:00").toLocaleDateString()} &mdash;{" "}
            {new Date(city.end_date + "T00:00:00").toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {!suggestionsGenerated && (
            <button onClick={generateSuggestions} className="btn-primary text-sm" disabled={generating}>
              {generating ? "Generating..." : "Generate Suggestions"}
            </button>
          )}
          {suggestionsGenerated && (
            <button onClick={generateItinerary} className="btn-secondary text-sm" disabled={generating}>
              {generating ? "Generating..." : versions.length > 0 ? "Regenerate Itinerary" : "Generate Itinerary"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {suggestionsGenerated && !versions.length && !generating && (
        <div className="card text-center py-8 mb-4">
          <p className="text-gray-500 mb-2">
            Suggestions generated: {attractions.length} attractions, {restaurants.length} restaurants
          </p>
          <p className="text-sm text-gray-400">Click &ldquo;Generate Itinerary&rdquo; to create a daily plan.</p>
        </div>
      )}

      {versions.length > 0 && (
        <>
          <div className="mb-4">
            <VersionNavigator
              versions={versions}
              currentVersion={currentVersion}
              onVersionChange={handleVersionChange}
            />
          </div>

          {dates.map((date) => (
            <Timeline key={date} blocks={blocksByDate[date]} date={date} />
          ))}

          <ModifyPlan
            tripId={tripId}
            cityId={city.id}
            cityName={city.name}
            onModified={refreshData}
          />
        </>
      )}
    </div>
  );
}
