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
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
            {tripId ? 'Update Trip Details' : 'Describe Your Trip'}
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Example: I want to go to Paris from March 15-20, 2026 with my wife Sarah and our two kids Tommy (8) and Emma (5). We're flying Air France AF123 departing 10am from JFK."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : tripId ? 'Update Trip' : 'Create Trip'}
        </button>
      </form>

      {tripDetails && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {tripId ? 'Trip Updated!' : 'Trip Created!'}
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <div className="font-semibold text-gray-900">Destination</div>
              <div className="text-gray-700">{tripDetails.trip.destination}</div>
            </div>

            <div>
              <div className="font-semibold text-gray-900">Dates</div>
              <div className="text-gray-700">
                {formatDate(tripDetails.trip.start_date)} - {formatDate(tripDetails.trip.end_date)}
              </div>
            </div>

            {tripDetails.travelers.length > 0 && (
              <div>
                <div className="font-semibold text-gray-900">Travelers</div>
                <div className="text-gray-700">
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
                <div className="font-semibold text-gray-900">Flights</div>
                <div className="text-gray-700">
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
                <div className="font-semibold text-gray-900">Hotels</div>
                <div className="text-gray-700">
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
            <div className="text-sm text-gray-600 italic">
              Redirecting to your trip...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
