import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MultiCityTimeline from '@/components/trip/MultiCityTimeline'
import { format } from 'date-fns'

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch trip details
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()

  if (tripError || !trip) {
    redirect('/dashboard')
  }

  // Check if user has access
  const { data: access } = await supabase
    .from('trip_collaborators')
    .select('role')
    .eq('trip_id', id)
    .eq('user_id', user.id)
    .single()

  const isOwner = trip.user_id === user.id

  if (!isOwner && !access) {
    redirect('/dashboard')
  }

  // Fetch all trip data including cities
  const [
    { data: cities, error: citiesError },
    { data: travelers },
    { data: flights },
    { data: hotels },
    { data: latestVersion },
  ] = await Promise.all([
    supabase.from('trip_cities').select('*').eq('trip_id', id).order('order_index'),
    supabase.from('travelers').select('*').eq('trip_id', id),
    supabase.from('flights').select('*').eq('trip_id', id).order('date'),
    supabase.from('hotels').select('*').eq('trip_id', id).order('check_in_date'),
    supabase
      .from('plan_versions')
      .select('*')
      .eq('trip_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()
  ])

  if (citiesError) {
    console.error('Error fetching cities:', citiesError)
  }

  // If no cities exist, create one from the trip destination (for backwards compatibility)
  let finalCities = cities || []
  if (finalCities.length === 0) {
    // Create a default city from the trip destination
    const { data: newCity, error: insertError } = await supabase
      .from('trip_cities')
      .insert({
        trip_id: id,
        name: trip.destination,
        start_date: trip.start_date,
        end_date: trip.end_date,
        order_index: 0
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating default city:', insertError)
    }

    if (newCity) {
      finalCities = [newCity]
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{trip.destination}</h1>
              <p className="text-sm text-slate-600">
                {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
              </p>
              {finalCities.length > 1 && (
                <p className="text-xs text-indigo-600 mt-1">
                  {finalCities.length} cities
                </p>
              )}
            </div>
            <a
              href="/dashboard"
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              ← Back to Trips
            </a>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {travelers && travelers.length > 0 && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-semibold text-slate-800 mb-2">Travelers:</h3>
            <div className="flex flex-wrap gap-2">
              {travelers.map((traveler) => (
                <span key={traveler.id} className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                  {traveler.name}{traveler.age ? ` (${traveler.age})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <MultiCityTimeline
          trip={trip}
          flights={flights || []}
          hotels={hotels || []}
          travelers={travelers || []}
          initialVersion={latestVersion}
          cities={finalCities}
        />
      </div>
    </div>
  )
}
