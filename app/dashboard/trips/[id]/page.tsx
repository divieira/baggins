import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TripTimeline from '@/components/trip/TripTimeline'
import { eachDayOfInterval, format } from 'date-fns'

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

  // Fetch all trip data
  const [
    { data: travelers },
    { data: flights },
    { data: hotels },
    { data: latestVersion },
  ] = await Promise.all([
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{trip.destination}</h1>
              <p className="text-sm text-gray-600">
                {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
              </p>
            </div>
            <a
              href="/dashboard"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back to Trips
            </a>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {travelers && travelers.length > 0 && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-semibold mb-2">Travelers:</h3>
            <div className="flex flex-wrap gap-2">
              {travelers.map((traveler) => (
                <span key={traveler.id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {traveler.name}{traveler.age ? ` (${traveler.age})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <TripTimeline
          trip={trip}
          flights={flights || []}
          hotels={hotels || []}
          travelers={travelers || []}
          initialVersion={latestVersion}
        />
      </div>
    </div>
  )
}
