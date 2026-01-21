'use client'

import { useState } from 'react'

interface Props {
  tripId: string
  currentVersionNumber: number
  totalVersions: number
  onVersionChange: (direction: 'prev' | 'next') => void
  onModificationComplete: () => void
}

export default function PlanModifier({
  tripId,
  currentVersionNumber,
  totalVersions,
  onVersionChange,
  onModificationComplete
}: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastSummary, setLastSummary] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const modificationRequest = input.trim()
    setInput('')
    setLoading(true)
    setLastSummary(null)

    try {
      const response = await fetch('/api/ai/modify-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          modificationRequest
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to modify plan')
      }

      const data = await response.json()
      setLastSummary(data.summary)

      // Notify parent to reload the plan
      onModificationComplete()
    } catch (error: any) {
      console.error('Error modifying plan:', error)
      setLastSummary(`Error: ${error.message || 'Failed to modify plan. Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  const canGoPrev = currentVersionNumber > 1
  const canGoNext = currentVersionNumber < totalVersions

  return (
    <div className="bg-white rounded-lg shadow-md flex flex-col">
      {/* Header */}
      <div className="bg-purple-600 text-white p-4 rounded-t-lg">
        <h3 className="font-semibold">AI Travel Assistant</h3>
        <p className="text-xs text-purple-100">
          Describe changes to update your plan
        </p>
      </div>

      {/* Version Navigation */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Version {currentVersionNumber} of {totalVersions}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onVersionChange('prev')}
              disabled={!canGoPrev || loading}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm font-medium text-gray-700"
              title="Previous version"
            >
              ← Prev
            </button>
            <button
              onClick={() => onVersionChange('next')}
              disabled={!canGoNext || loading}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm font-medium text-gray-700"
              title="Next version"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Last modification summary */}
      {lastSummary && (
        <div className={`p-4 border-b ${lastSummary.startsWith('Error:') ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <p className={`text-sm ${lastSummary.startsWith('Error:') ? 'text-red-800' : 'text-green-800'}`}>
            {lastSummary}
          </p>
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="text-sm text-gray-600 space-y-2">
          <p className="font-medium">Try asking:</p>
          <ul className="space-y-1 text-xs pl-4">
            <li>• &quot;Add kid-friendly activities for the mornings&quot;</li>
            <li>• &quot;Find romantic restaurants for dinners&quot;</li>
            <li>• &quot;Add outdoor activities to afternoons&quot;</li>
            <li>• &quot;Replace lunch on day 2 with Italian food&quot;</li>
          </ul>
        </div>

        {loading && (
          <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm text-purple-800">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span>Updating your plan...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
        <div className="space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the changes you want to make..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
            rows={3}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading ? 'Updating Plan...' : 'Update Plan'}
          </button>
        </div>
      </form>
    </div>
  )
}
