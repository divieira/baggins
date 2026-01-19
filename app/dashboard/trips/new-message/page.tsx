import MessageBasedTripCreator from '@/components/trip/MessageBasedTripCreator'
import Link from 'next/link'

export default function NewMessageTripPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/dashboard/trips/new"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          ← Back to traditional form
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Create Trip with AI</h1>
          <p className="mt-2 text-gray-300">
            Simply describe your trip in natural language, and our AI will extract all the details for you.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="font-semibold text-blue-900 mb-2">Tips for best results:</h2>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Include destination, dates, and travelers</li>
            <li>• Mention flight details if known (airline, flight number, times)</li>
            <li>• Add hotel information (name, dates, location)</li>
            <li>• You can paste multiple messages to add more details</li>
          </ul>
        </div>

        <MessageBasedTripCreator />

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Examples:</h2>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="bg-white p-3 rounded border border-gray-200">
              "Planning a family trip to Tokyo from April 10-17, 2026. Going with my wife Lisa and kids Jake (12) and Mia (9)."
            </div>
            <div className="bg-white p-3 rounded border border-gray-200">
              "Weekend getaway to Miami Beach, May 3-5. Staying at the Fontainebleau Hotel. Flying Delta DL456 leaving Friday at 2pm from Atlanta."
            </div>
            <div className="bg-white p-3 rounded border border-gray-200">
              "Solo backpacking trip across Europe: London, Paris, Barcelona. June 1-21, 2026."
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
