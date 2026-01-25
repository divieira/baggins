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
  cities?: Array<{
    id: string
    name: string
    start_date: string
    end_date: string
  }>
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
  attractions?: Array<any>
  parsed: any
}

type ProgressStep = 'parsing' | 'generating-suggestions' | 'generating-itinerary' | 'complete'

interface MessageBasedTripCreatorProps {
  tripId?: string
  onTripCreated?: (tripId: string) => void
}

export default function MessageBasedTripCreator({ tripId, onTripCreated }: MessageBasedTripCreatorProps) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null)
  const [progressStep, setProgressStep] = useState<ProgressStep | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim()) {
      setError('Please enter a message')
      return
    }

    setLoading(true)
    setError(null)
    setProgressStep('parsing')

    try {
      // Step 1: Parse trip and generate suggestions
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

      setProgressStep('generating-suggestions')
      setTripDetails(data)

      // Step 2: Auto-generate itinerary for each city with attractions
      if (!tripId && data.cities && data.cities.length > 0 && data.attractions && data.attractions.length > 0) {
        setProgressStep('generating-itinerary')

        // Group attractions by city
        const attractionsByCity = data.attractions.reduce((acc: any, attr: any) => {
          if (!acc[attr.city_id]) {
            acc[attr.city_id] = []
          }
          acc[attr.city_id].push(attr.id)
          return acc
        }, {})

        // Generate itinerary for each city
        for (const city of data.cities) {
          const selectedAttractionIds = attractionsByCity[city.id] || []

          if (selectedAttractionIds.length > 0) {
            try {
              await fetch('/api/ai/generate-itinerary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tripId: data.trip.id,
                  cityId: city.id,
                  selectedAttractionIds
                })
              })
            } catch (err) {
              console.error(`Failed to generate itinerary for ${city.name}:`, err)
              // Continue with other cities even if one fails
            }
          }
        }
      }

      setProgressStep('complete')
      setMessage('') // Clear the input for next message

      // Call callback if provided
      if (onTripCreated) {
        onTripCreated(data.trip.id)
      }

      // If this is a new trip, navigate to it after a short delay
      if (!tripId) {
        setTimeout(() => {
          router.push(`/dashboard/trips/${data.trip.id}`)
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message)
      setProgressStep(null)
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

        {/* Progress Bar */}
        {loading && progressStep && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center animate-spin">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-blue-900">
                  {progressStep === 'parsing' && 'Parsing your trip details...'}
                  {progressStep === 'generating-suggestions' && 'Finding amazing places to visit...'}
                  {progressStep === 'generating-itinerary' && 'Creating your perfect itinerary...'}
                  {progressStep === 'complete' && 'All set! Redirecting...'}
                </div>
                <div className="text-sm text-blue-600 mt-1">
                  {progressStep === 'parsing' && 'Understanding your travel plans'}
                  {progressStep === 'generating-suggestions' && 'Discovering attractions and restaurants'}
                  {progressStep === 'generating-itinerary' && 'Optimizing your schedule'}
                  {progressStep === 'complete' && 'Your adventure awaits!'}
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex gap-2">
              <div className={`flex-1 h-2 rounded-full transition-all ${
                ['parsing', 'generating-suggestions', 'generating-itinerary', 'complete'].includes(progressStep)
                  ? 'bg-blue-500'
                  : 'bg-blue-200'
              }`}></div>
              <div className={`flex-1 h-2 rounded-full transition-all ${
                ['generating-suggestions', 'generating-itinerary', 'complete'].includes(progressStep)
                  ? 'bg-blue-500'
                  : 'bg-blue-200'
              }`}></div>
              <div className={`flex-1 h-2 rounded-full transition-all ${
                ['generating-itinerary', 'complete'].includes(progressStep)
                  ? 'bg-blue-500'
                  : 'bg-blue-200'
              }`}></div>
              <div className={`flex-1 h-2 rounded-full transition-all ${
                progressStep === 'complete'
                  ? 'bg-blue-500'
                  : 'bg-blue-200'
              }`}></div>
            </div>
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
