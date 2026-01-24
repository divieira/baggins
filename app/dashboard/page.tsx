import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format, differenceInDays } from 'date-fns'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Ensure user exists in users table
  await supabase.from('users').upsert({ id: user.id, email: user.email! })

  // Fetch user's trips with counts
  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false })

  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
  }

  // Calculate stats
  const totalTrips = trips?.length || 0
  const uniqueDestinations = trips ? new Set(trips.map(t => t.destination.split(',')[0].trim())).size : 0
  const totalDays = trips ? trips.reduce((sum, t) =>
    sum + differenceInDays(new Date(t.end_date), new Date(t.start_date)) + 1, 0) : 0

  // Get user initials
  const userInitial = user.email?.[0].toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />

      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-stone-800"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Baggins
            </h1>
            <p className="text-stone-400 text-sm mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              The road goes ever on 🗺️
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-rose-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-orange-200">
              {userInitial}
            </div>
            <form action={handleSignOut}>
              <button
                type="submit"
                className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="px-5 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 bg-white/60 backdrop-blur rounded-2xl p-4 border border-white">
            <div className="text-3xl mb-1">{totalTrips}</div>
            <div className="text-stone-500 text-sm">Adventures</div>
          </div>
          <div className="flex-1 bg-white/60 backdrop-blur rounded-2xl p-4 border border-white">
            <div className="text-3xl mb-1">{uniqueDestinations}</div>
            <div className="text-stone-500 text-sm">Places</div>
          </div>
          <div className="flex-1 bg-white/60 backdrop-blur rounded-2xl p-4 border border-white">
            <div className="text-3xl mb-1">{totalDays}</div>
            <div className="text-stone-500 text-sm">Days planned</div>
          </div>
        </div>
      </div>

      <div className="px-5 mb-6">
        <Link
          href="/dashboard/trips/new"
          className="w-full bg-white/80 backdrop-blur border-2 border-dashed border-orange-300 rounded-2xl p-5 flex items-center justify-center gap-3 hover:bg-orange-50 hover:border-orange-400 transition-all group"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-rose-400 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-left">
            <div className="font-semibold text-stone-700">Plan a new adventure</div>
            <div className="text-stone-400 text-sm">AI will help you every step ✨</div>
          </div>
        </Link>
      </div>

      <div className="px-5 pb-8">
        <h2 className="text-lg font-semibold text-stone-700 mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Your Trips
        </h2>

        {trips && trips.length > 0 ? (
          <div className="space-y-4">
            {trips.map((trip) => {
              const daysCount = differenceInDays(new Date(trip.end_date), new Date(trip.start_date)) + 1
              const isUpcoming = new Date(trip.start_date) > new Date()
              const isCompleted = new Date(trip.end_date) < new Date()

              return (
                <Link
                  key={trip.id}
                  href={`/dashboard/trips/${trip.id}`}
                  className="block w-full bg-white rounded-3xl p-5 shadow-lg shadow-stone-100 hover:shadow-xl transition-all hover:-translate-y-1 group relative overflow-hidden"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-orange-400 to-rose-500" />

                  <div className="flex items-start gap-4 pl-2">
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-rose-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                      🗺️
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-stone-800 text-lg group-hover:text-orange-600 transition-colors">
                            {trip.destination}
                          </h3>
                          <p className="text-stone-500 text-sm mt-1">
                            {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')} • {daysCount} days
                          </p>
                        </div>
                        {isUpcoming && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-600 text-xs font-semibold rounded-full">
                            Upcoming
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-3 py-1 bg-stone-100 text-stone-500 text-xs font-semibold rounded-full">
                            Completed ✓
                          </span>
                        )}
                        {!isUpcoming && !isCompleted && (
                          <span className="px-3 py-1 bg-orange-100 text-orange-600 text-xs font-semibold rounded-full">
                            Planning
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur rounded-3xl p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-rose-400 rounded-3xl flex items-center justify-center text-4xl shadow-xl shadow-orange-200 mx-auto mb-6">
              🎒
            </div>
            <p className="text-stone-600 mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              You haven&apos;t created any trips yet.
            </p>
            <Link
              href="/dashboard/trips/new"
              className="inline-block px-8 py-4 bg-gradient-to-r from-orange-400 to-rose-400 hover:from-orange-500 hover:to-rose-500 text-white font-semibold rounded-2xl shadow-lg shadow-orange-200 transition-all hover:shadow-xl"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Create Your First Trip →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
