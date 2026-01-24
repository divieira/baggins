/**
 * React hook for detecting online/offline status
 * Provides real-time updates when connectivity changes
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

export interface OnlineStatus {
  isOnline: boolean
  wasOffline: boolean // True if user was offline at some point during session
  lastOnlineAt: Date | null
  lastOfflineAt: Date | null
}

export function useOnlineStatus(): OnlineStatus {
  // Initialize state with the correct values based on navigator.onLine
  const [status, setStatus] = useState<OnlineStatus>(() => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    return {
      isOnline,
      wasOffline: !isOnline,
      lastOnlineAt: isOnline ? new Date() : null,
      lastOfflineAt: isOnline ? null : new Date(),
    }
  })

  const handleOnline = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      isOnline: true,
      lastOnlineAt: new Date(),
    }))
  }, [])

  const handleOffline = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      isOnline: false,
      wasOffline: true,
      lastOfflineAt: new Date(),
    }))
  }, [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return status
}

/**
 * Simple hook that just returns boolean online status
 */
export function useIsOnline(): boolean {
  const { isOnline } = useOnlineStatus()
  return isOnline
}
