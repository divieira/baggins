'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Traveler {
  name: string
  age: string
  relationship: string
}

interface Flight {
  date: string
  departureAirport: string
  arrivalAirport: string
  departureTime: string
  arrivalTime: string
  flightNumber: string
  airline: string
}

interface Hotel {
  name: string
  address: string
  checkInDate: string
  checkOutDate: string
}

export default function NewTrip() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Trip basic info
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Travelers
  const [travelers, setTravelers] = useState<Traveler[]>([
    { name: '', age: '', relationship: '' }
  ])

  // Flights
  const [flights, setFlights] = useState<Flight[]>([
    {
      date: '',
      departureAirport: '',
      arrivalAirport: '',
      departureTime: '',
      arrivalTime: '',
      flightNumber: '',
      airline: ''
    }
  ])

  // Hotels
  const [hotels, setHotels] = useState<Hotel[]>([
    {
      name: '',
      address: '',
      checkInDate: '',
      checkOutDate: ''
    }
  ])

  const addTraveler = () => {
    setTravelers([...travelers, { name: '', age: '', relationship: '' }])
  }

  const removeTraveler = (index: number) => {
    setTravelers(travelers.filter((_, i) => i !== index))
  }

  const updateTraveler = (index: number, field: keyof Traveler, value: string) => {
    const updated = [...travelers]
    updated[index][field] = value
    setTravelers(updated)
  }

  const addFlight = () => {
    setFlights([...flights, {
      date: '',
      departureAirport: '',
      arrivalAirport: '',
      departureTime: '',
      arrivalTime: '',
      flightNumber: '',
      airline: ''
    }])
  }

  const removeFlight = (index: number) => {
    setFlights(flights.filter((_, i) => i !== index))
  }

  const updateFlight = (index: number, field: keyof Flight, value: string) => {
    const updated = [...flights]
    updated[index][field] = value
    setFlights(updated)
  }

  const addHotel = () => {
    setHotels([...hotels, {
      name: '',
      address: '',
      checkInDate: '',
      checkOutDate: ''
    }])
  }

  const removeHotel = (index: number) => {
    setHotels(hotels.filter((_, i) => i !== index))
  }

  const updateHotel = (index: number, field: keyof Hotel, value: string) => {
    const updated = [...hotels]
    updated[index][field] = value
    setHotels(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create trip
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          destination,
          start_date: startDate,
          end_date: endDate
        })
        .select()
        .single()

      if (tripError) throw tripError

      // Create collaborator record (owner)
      await supabase.from('trip_collaborators').insert({
        trip_id: trip.id,
        user_id: user.id,
        role: 'owner'
      })

      // Add travelers
      if (travelers.some(t => t.name)) {
        const validTravelers = travelers.filter(t => t.name.trim())
        await supabase.from('travelers').insert(
          validTravelers.map(t => ({
            trip_id: trip.id,
            name: t.name,
            age: t.age ? parseInt(t.age) : null,
            relationship: t.relationship || null
          }))
        )
      }

      // Add flights
      if (flights.some(f => f.departureAirport && f.arrivalAirport)) {
        const validFlights = flights.filter(f => f.departureAirport && f.arrivalAirport)
        await supabase.from('flights').insert(
          validFlights.map(f => ({
            trip_id: trip.id,
            date: f.date,
            departure_airport: f.departureAirport,
            arrival_airport: f.arrivalAirport,
            departure_time: f.departureTime,
            arrival_time: f.arrivalTime,
            flight_number: f.flightNumber || null,
            airline: f.airline || null
          }))
        )
      }

      // Add hotels
      if (hotels.some(h => h.name && h.address)) {
        const validHotels = hotels.filter(h => h.name && h.address)
        await supabase.from('hotels').insert(
          validHotels.map(h => ({
            trip_id: trip.id,
            name: h.name,
            address: h.address,
            check_in_date: h.checkInDate,
            check_out_date: h.checkOutDate
          }))
        )
      }

      // Redirect to trip page
      router.push(`/dashboard/trips/${trip.id}`)
    } catch (err: any) {
      console.error('Error creating trip:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Create New Trip</h1>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Try our AI-powered trip creator!</strong> Simply paste a message describing your trip and let Claude fill in the details.{' '}
            <Link href="/dashboard/trips/new-message" className="text-blue-600 hover:text-blue-700 font-medium underline">
              Create with AI →
            </Link>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Trip Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destination *
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Paris, France"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Travelers */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Who&apos;s Coming?</h2>
              <button
                type="button"
                onClick={addTraveler}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add Traveler
              </button>
            </div>
            <div className="space-y-4">
              {travelers.map((traveler, index) => (
                <div key={index} className="border border-gray-200 p-4 rounded-md">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={traveler.name}
                        onChange={(e) => updateTraveler(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Age
                      </label>
                      <input
                        type="number"
                        value={traveler.age}
                        onChange={(e) => updateTraveler(index, 'age', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Age"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Relationship
                      </label>
                      <input
                        type="text"
                        value={traveler.relationship}
                        onChange={(e) => updateTraveler(index, 'relationship', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="e.g., Child, Spouse"
                      />
                    </div>
                  </div>
                  {travelers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTraveler(index)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Flights */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Flights</h2>
              <button
                type="button"
                onClick={addFlight}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add Flight
              </button>
            </div>
            <div className="space-y-4">
              {flights.map((flight, index) => (
                <div key={index} className="border border-gray-200 p-4 rounded-md">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={flight.date}
                        onChange={(e) => updateFlight(index, 'date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Airline
                      </label>
                      <input
                        type="text"
                        value={flight.airline}
                        onChange={(e) => updateFlight(index, 'airline', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Airline"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Flight Number
                      </label>
                      <input
                        type="text"
                        value={flight.flightNumber}
                        onChange={(e) => updateFlight(index, 'flightNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Flight #"
                      />
                    </div>
                    <div></div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From
                      </label>
                      <input
                        type="text"
                        value={flight.departureAirport}
                        onChange={(e) => updateFlight(index, 'departureAirport', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Airport code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Departure Time
                      </label>
                      <input
                        type="time"
                        value={flight.departureTime}
                        onChange={(e) => updateFlight(index, 'departureTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        To
                      </label>
                      <input
                        type="text"
                        value={flight.arrivalAirport}
                        onChange={(e) => updateFlight(index, 'arrivalAirport', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Airport code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Arrival Time
                      </label>
                      <input
                        type="time"
                        value={flight.arrivalTime}
                        onChange={(e) => updateFlight(index, 'arrivalTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  {flights.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFlight(index)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Hotels */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Hotels</h2>
              <button
                type="button"
                onClick={addHotel}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add Hotel
              </button>
            </div>
            <div className="space-y-4">
              {hotels.map((hotel, index) => (
                <div key={index} className="border border-gray-200 p-4 rounded-md">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hotel Name
                      </label>
                      <input
                        type="text"
                        value={hotel.name}
                        onChange={(e) => updateHotel(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Hotel name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        value={hotel.address}
                        onChange={(e) => updateHotel(index, 'address', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Check-in
                      </label>
                      <input
                        type="date"
                        value={hotel.checkInDate}
                        onChange={(e) => updateHotel(index, 'checkInDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Check-out
                      </label>
                      <input
                        type="date"
                        value={hotel.checkOutDate}
                        onChange={(e) => updateHotel(index, 'checkOutDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  {hotels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHotel(index)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Trip & Generate Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
