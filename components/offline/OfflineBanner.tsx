'use client'

import { useOnlineStatus } from '@/lib/offline'

interface Props {
  showWhenOnline?: boolean
}

export default function OfflineBanner({ showWhenOnline = false }: Props) {
  const { isOnline, wasOffline } = useOnlineStatus()

  // Show offline banner when offline
  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium">
        <span className="mr-2">📡</span>
        You&apos;re offline. Showing cached data (read-only).
      </div>
    )
  }

  // Optionally show "back online" message
  if (showWhenOnline && wasOffline) {
    return (
      <div className="bg-green-500 text-white px-4 py-2 text-center text-sm font-medium animate-pulse">
        <span className="mr-2">✓</span>
        Back online! Data will sync automatically.
      </div>
    )
  }

  return null
}
