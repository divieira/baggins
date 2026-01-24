'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tripId: string
  tripName: string
}

export default function DeleteTripButton({ tripId, tripName }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch('/api/trips/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete trip')
      }

      // Redirect to dashboard after successful deletion
      router.push('/dashboard')
    } catch (error) {
      console.error('Error deleting trip:', error)
      alert('Failed to delete trip. Please try again.')
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="text-sm text-red-600 hover:text-red-700 font-medium"
      >
        Delete Trip
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-700">Delete {tripName}?</span>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
      >
        {deleting ? 'Deleting...' : 'Yes, Delete'}
      </button>
      <button
        onClick={() => setShowConfirm(false)}
        disabled={deleting}
        className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  )
}
