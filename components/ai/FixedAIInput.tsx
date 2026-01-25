'use client'

import { useState } from 'react'

interface ModifyPlanResponse {
  success: boolean
  versionId: string
  versionNumber: number
  summary: string
}

interface Props {
  tripId: string
  onModificationComplete: (response?: ModifyPlanResponse) => void
}

export default function FixedAIInput({ tripId, onModificationComplete }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const modificationRequest = input.trim()
    setInput('')
    setLoading(true)
    setFeedback(null)

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

      const data = await response.json() as ModifyPlanResponse
      console.log('[FixedAIInput] API response:', data)
      setFeedback({ type: 'success', message: data.summary })

      // Clear feedback after 4 seconds
      setTimeout(() => setFeedback(null), 4000)

      // Notify parent to reload the plan with the response data
      console.log('[FixedAIInput] Calling onModificationComplete with versionId:', data.versionId)
      onModificationComplete(data)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to modify plan'
      setFeedback({ type: 'error', message: errorMessage })
      setTimeout(() => setFeedback(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
      {/* Feedback toast */}
      {feedback && (
        <div className={`px-4 py-2 text-sm ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
            : 'bg-red-50 text-red-800 border-b border-red-200'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="px-4 py-2 bg-teal-50 border-b border-teal-200">
          <div className="flex items-center gap-2 text-sm text-teal-800">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span>Updating your plan...</span>
          </div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-3 safe-area-inset-bottom">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI to modify your plan..."
            className="flex-1 px-4 py-2.5 bg-slate-100 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm text-slate-800 placeholder-slate-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
