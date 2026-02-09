import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Trip } from "@/types/database";
import TripCreator from "@/components/TripCreator";
import DeleteTripButton from "@/components/DeleteTripButton";

export const dynamic = "force-dynamic";

function getTripStatus(trip: Trip): { label: string; color: string } {
  const today = new Date().toISOString().split("T")[0];
  if (trip.end_date < today) return { label: "Completed", color: "bg-gray-100 text-gray-700" };
  if (trip.start_date <= today) return { label: "In Progress", color: "bg-green-100 text-green-700" };
  return { label: "Upcoming", color: "bg-blue-100 text-blue-700" };
}

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: false });

  const { data: travelerCounts } = await supabase
    .from("travelers")
    .select("trip_id");

  const countMap: Record<string, number> = {};
  travelerCounts?.forEach((t: { trip_id: string }) => {
    countMap[t.trip_id] = (countMap[t.trip_id] || 0) + 1;
  });

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Baggins</h1>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="btn-secondary text-sm">
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Plan a New Trip</h2>
          <TripCreator />
        </div>

        <h2 className="text-xl font-semibold mb-4">Your Trips</h2>
        {!trips || trips.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No trips yet. Describe a trip above to get started!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip: Trip) => {
              const status = getTripStatus(trip);
              return (
                <div key={trip.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <Link href={`/trips/${trip.id}`} className="flex-1">
                      <h3 className="font-semibold text-lg hover:text-primary-600">
                        {trip.destination}
                      </h3>
                    </Link>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">
                    {new Date(trip.start_date + "T00:00:00").toLocaleDateString()} &mdash;{" "}
                    {new Date(trip.end_date + "T00:00:00").toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-500 mb-3">
                    {countMap[trip.id] || 0} traveler{(countMap[trip.id] || 0) !== 1 ? "s" : ""}
                  </p>
                  <div className="flex justify-between items-center">
                    <Link
                      href={`/trips/${trip.id}`}
                      className="text-primary-600 text-sm font-medium hover:underline"
                    >
                      View Itinerary
                    </Link>
                    <DeleteTripButton tripId={trip.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
