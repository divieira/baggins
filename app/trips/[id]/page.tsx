import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { City, Attraction, Restaurant, PlanVersion, TimeBlock } from "@/types/database";
import CityItinerary from "@/components/CityItinerary";
import ChatPanel from "@/components/ChatPanel";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: PageProps) {
  const { id: tripId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (!trip) redirect("/dashboard");

  // Fetch all related data
  const [citiesRes, travelersRes, flightsRes, hotelsRes] = await Promise.all([
    supabase.from("cities").select("*").eq("trip_id", tripId).order("city_order"),
    supabase.from("travelers").select("*").eq("trip_id", tripId),
    supabase.from("flights").select("*").eq("trip_id", tripId).order("date"),
    supabase.from("hotels").select("*").eq("trip_id", tripId),
  ]);

  const cities = (citiesRes.data || []) as City[];
  const travelers = travelersRes.data || [];
  const flights = flightsRes.data || [];
  const hotels = hotelsRes.data || [];

  // For each city, load attractions, restaurants, plan versions, and time blocks
  const cityData = await Promise.all(
    cities.map(async (city) => {
      const [attractionsRes, restaurantsRes, versionsRes] = await Promise.all([
        supabase.from("attractions").select("*").eq("city_id", city.id),
        supabase.from("restaurants").select("*").eq("city_id", city.id),
        supabase.from("plan_versions").select("*").eq("city_id", city.id).order("version_number"),
      ]);

      const versions = (versionsRes.data || []) as PlanVersion[];
      let blocks: TimeBlock[] = [];

      if (versions.length > 0) {
        const latestVersion = versions[versions.length - 1];
        const blocksRes = await supabase
          .from("time_blocks")
          .select("*, attractions:selected_attraction_id(*), restaurants:selected_restaurant_id(*)")
          .eq("plan_version_id", latestVersion.id)
          .order("date")
          .order("start_time");

        blocks = (blocksRes.data || []).map((b) => ({
          ...b,
          attraction: b.attractions as unknown as Attraction | null,
          restaurant: b.restaurants as unknown as Restaurant | null,
        })) as TimeBlock[];
      }

      return {
        city,
        attractions: (attractionsRes.data || []) as Attraction[],
        restaurants: (restaurantsRes.data || []) as Restaurant[],
        versions,
        blocks,
      };
    })
  );

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              &larr; Back
            </Link>
            <h1 className="text-2xl font-bold">{trip.destination}</h1>
          </div>
          <p className="text-sm text-gray-500">
            {new Date(trip.start_date + "T00:00:00").toLocaleDateString()} &mdash;{" "}
            {new Date(trip.end_date + "T00:00:00").toLocaleDateString()}
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Trip overview */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          {travelers.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-sm text-gray-500 mb-2">Travelers</h3>
              <ul className="space-y-1">
                {travelers.map((t) => (
                  <li key={t.id} className="text-sm">
                    {t.name}{t.age ? ` (${t.age})` : ""}{t.relationship ? ` - ${t.relationship}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {flights.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-sm text-gray-500 mb-2">Flights</h3>
              <ul className="space-y-1">
                {flights.map((f) => (
                  <li key={f.id} className="text-sm">
                    {f.departure_airport} &rarr; {f.arrival_airport} ({new Date(f.date + "T00:00:00").toLocaleDateString()})
                    {f.airline && ` - ${f.airline}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hotels.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-sm text-gray-500 mb-2">Hotels</h3>
              <ul className="space-y-1">
                {hotels.map((h) => (
                  <li key={h.id} className="text-sm">{h.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* City itineraries */}
        {cityData.map(({ city, attractions, restaurants, versions, blocks }) => (
          <CityItinerary
            key={city.id}
            tripId={tripId}
            city={city}
            initialAttractions={attractions}
            initialRestaurants={restaurants}
            initialVersions={versions}
            initialBlocks={blocks}
          />
        ))}

        {/* Chat panel */}
        <div className="mt-8">
          <ChatPanel tripId={tripId} />
        </div>
      </main>
    </div>
  );
}
