'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TripDetails {
  trip: {
    id: string
    destination: string
    start_date: string
    end_date: string
  }
  travelers: Array<{
    id: string
    name: string
    age?: number
  }>
  flights: Array<{
    id: string
    airline: string
    flight_number: string
    departure_time: string
    arrival_time: string
    from_location: string
    to_location: string
  }>
  hotels: Array<{
    id: string
    name: string
    check_in_date: string
    check_out_date: string
    address: string
  }>
  parsed: any
}

interface MessageBasedTripCreatorProps {
  tripId?: string
  onTripCreated?: (tripId: string) => void
}

export default function MessageBasedTripCreator({ tripId, onTripCreated }: MessageBasedTripCreatorProps) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim()) {
      setError('Please enter a message')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/parse-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, tripId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse trip details')
      }

      setTripDetails(data)
      setMessage('') // Clear the input for next message

      // Call callback if provided
      if (onTripCreated) {
        onTripCreated(data.trip.id)
      }

      // If this is a new trip, navigate to it after a short delay
      if (!tripId) {
        setTimeout(() => {
          router.push(`/dashboard/trips/${data.trip.id}`)
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-stone-600 mb-3">
            {tripId ? 'Update Trip Details' : 'Describe your trip'}
          </label>
          <div className="relative">
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="I want to explore Chile for a week with my family. We love hiking, great food, and maybe visit a volcano..."
              className="w-full bg-stone-50 border-2 border-stone-100 focus:border-orange-300 focus:bg-white rounded-2xl p-4 min-h-[140px] text-stone-700 placeholder-stone-400 outline-none transition-all resize-none"
              disabled={loading}
            />
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button type="button" className="w-10 h-10 bg-stone-100 hover:bg-stone-200 rounded-xl flex items-center justify-center transition-colors">
                <span className="text-lg">🎤</span>
              </button>
              <button type="button" className="w-10 h-10 bg-stone-100 hover:bg-stone-200 rounded-xl flex items-center justify-center transition-colors">
                <span className="text-lg">📎</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border-2 border-rose-200 text-rose-700 px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="w-full bg-gradient-to-r from-orange-400 to-rose-400 hover:from-orange-500 hover:to-rose-500 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-orange-200 transition-all hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{loading ? 'Creating your adventure...' : tripId ? 'Update Trip' : 'Create Trip'}</span>
          <span>→</span>
        </button>
      </form>

      {tripDetails && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {tripId ? 'Trip Updated!' : 'Adventure Created! 🎒'}
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <div className="font-semibold text-stone-800">Destination</div>
              <div className="text-stone-600">{tripDetails.trip.destination}</div>
            </div>

            <div>
              <div className="font-semibold text-stone-800">Dates</div>
              <div className="text-stone-600">
                {formatDate(tripDetails.trip.start_date)} - {formatDate(tripDetails.trip.end_date)}
              </div>
            </div>

            {tripDetails.travelers.length > 0 && (
              <div>
                <div className="font-semibold text-stone-800">Travelers</div>
                <div className="text-stone-600">
                  {tripDetails.travelers.map((t, i) => (
                    <div key={i}>
                      {t.name}{t.age ? ` (${t.age})` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tripDetails.flights.length > 0 && (
              <div>
                <div className="font-semibold text-stone-800">Flights</div>
                <div className="text-stone-600">
                  {tripDetails.flights.map((f, i) => (
                    <div key={i}>
                      {f.airline} {f.flight_number}: {f.from_location} → {f.to_location}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tripDetails.hotels.length > 0 && (
              <div>
                <div className="font-semibold text-stone-800">Hotels</div>
                <div className="text-stone-600">
                  {tripDetails.hotels.map((h, i) => (
                    <div key={i}>
                      {h.name} ({formatDate(h.check_in_date)} - {formatDate(h.check_out_date)})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!tripId && (
            <div className="text-sm text-stone-500 italic flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Preparing your journey...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
