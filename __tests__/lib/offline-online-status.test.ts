/**
 * Tests for useOnlineStatus hook
 */

import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus, useIsOnline } from '@/lib/offline/useOnlineStatus'

describe('useOnlineStatus', () => {
  // Store original navigator.onLine
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine')

  // Mock event listeners
  let onlineCallback: (() => void) | null = null
  let offlineCallback: (() => void) | null = null

  beforeEach(() => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })

    // Mock addEventListener
    jest.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'online') onlineCallback = handler as () => void
      if (event === 'offline') offlineCallback = handler as () => void
    })

    jest.spyOn(window, 'removeEventListener').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore original navigator.onLine
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine)
    }
    jest.restoreAllMocks()
    onlineCallback = null
    offlineCallback = null
  })

  describe('useOnlineStatus hook', () => {
    it('returns initial online status', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current.isOnline).toBe(true)
      expect(result.current.wasOffline).toBe(false)
    })

    it('returns initial offline status', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current.isOnline).toBe(false)
      expect(result.current.wasOffline).toBe(true)
    })

    it('updates when going offline', () => {
      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current.isOnline).toBe(true)

      // Simulate going offline
      act(() => {
        if (offlineCallback) offlineCallback()
      })

      expect(result.current.isOnline).toBe(false)
      expect(result.current.wasOffline).toBe(true)
      expect(result.current.lastOfflineAt).toBeInstanceOf(Date)
    })

    it('updates when coming back online', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current.isOnline).toBe(false)

      // Simulate coming online
      act(() => {
        if (onlineCallback) onlineCallback()
      })

      expect(result.current.isOnline).toBe(true)
      expect(result.current.lastOnlineAt).toBeInstanceOf(Date)
    })

    it('tracks wasOffline flag across status changes', () => {
      const { result } = renderHook(() => useOnlineStatus())

      // Initially online, wasOffline should be false
      expect(result.current.wasOffline).toBe(false)

      // Go offline
      act(() => {
        if (offlineCallback) offlineCallback()
      })
      expect(result.current.wasOffline).toBe(true)

      // Come back online - wasOffline should remain true
      act(() => {
        if (onlineCallback) onlineCallback()
      })
      expect(result.current.isOnline).toBe(true)
      expect(result.current.wasOffline).toBe(true)
    })

    it('sets up and cleans up event listeners', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useOnlineStatus())

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    })
  })

  describe('useIsOnline hook', () => {
    it('returns boolean online status', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      const { result } = renderHook(() => useIsOnline())

      expect(result.current).toBe(true)
    })

    it('returns false when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const { result } = renderHook(() => useIsOnline())

      expect(result.current).toBe(false)
    })

    it('updates when connectivity changes', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      const { result } = renderHook(() => useIsOnline())

      expect(result.current).toBe(true)

      act(() => {
        if (offlineCallback) offlineCallback()
      })

      expect(result.current).toBe(false)
    })
  })
})
