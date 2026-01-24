'use client'

import MessageBasedTripCreator from '@/components/trip/MessageBasedTripCreator'
import Link from 'next/link'

export default function NewTrip() {
  const examples = [
    { text: "Family trip to Tokyo, April 10-17 with my wife and 2 kids", icon: "🗼" },
    { text: "Romantic getaway to Santorini for our anniversary", icon: "💑" },
    { text: "Solo backpacking through Portugal for 2 weeks", icon: "🎒" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />

      <div className="px-5 pt-14 pb-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-stone-500 hover:text-stone-700 transition-colors mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span style={{ fontFamily: "'DM Sans', sans-serif" }}>Back to trips</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-rose-400 rounded-3xl flex items-center justify-center shadow-xl shadow-orange-200">
            <span className="text-3xl">✨</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-800" style={{ fontFamily: "'Playfair Display', serif" }}>
              New Adventure
            </h1>
            <p className="text-stone-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              There and back again
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl p-5 mb-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🪄</span>
              <span className="font-semibold">AI-Powered Planning</span>
            </div>
            <p className="text-violet-100 text-sm">
              Describe your trip naturally and our AI will extract dates, destinations, and travelers to craft your perfect itinerary.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-lg shadow-stone-100 mb-6">
          <MessageBasedTripCreator />
        </div>

        <div>
          <h3 className="text-sm font-medium text-stone-500 mb-3">Try an example</h3>
          <div className="space-y-2">
            {examples.map((example, i) => (
              <button
                key={i}
                onClick={() => {
                  const textarea = document.querySelector('textarea') as HTMLTextAreaElement
                  if (textarea) {
                    textarea.value = example.text
                    textarea.dispatchEvent(new Event('input', { bubbles: true }))
                  }
                }}
                className="w-full bg-white/60 hover:bg-white border border-white hover:border-orange-200 rounded-2xl p-4 text-left transition-all flex items-center gap-3"
              >
                <span className="text-2xl">{example.icon}</span>
                <span className="text-stone-600 text-sm">{example.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
            <span>💡</span> Tips for best results
          </h4>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• Include who&apos;s traveling (names and ages)</li>
            <li>• Mention your interests and must-sees</li>
            <li>• Add flight/hotel info if you have it</li>
            <li>• Be as detailed or casual as you like</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
