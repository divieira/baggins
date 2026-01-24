/**
 * Tests for OfflineBanner component
 */

import { render, screen } from '@testing-library/react'
import OfflineBanner from '@/components/offline/OfflineBanner'

// Mock the useOnlineStatus hook
jest.mock('@/lib/offline', () => ({
  useOnlineStatus: jest.fn(),
}))

import { useOnlineStatus } from '@/lib/offline'

const mockUseOnlineStatus = useOnlineStatus as jest.MockedFunction<typeof useOnlineStatus>

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders offline banner when offline', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: false,
      wasOffline: true,
      lastOnlineAt: null,
      lastOfflineAt: new Date(),
    })

    render(<OfflineBanner />)

    expect(screen.getByText(/You're offline/)).toBeInTheDocument()
    expect(screen.getByText(/Showing cached data/)).toBeInTheDocument()
  })

  it('renders nothing when online and showWhenOnline is false', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      wasOffline: false,
      lastOnlineAt: new Date(),
      lastOfflineAt: null,
    })

    const { container } = render(<OfflineBanner />)

    expect(container.firstChild).toBeNull()
  })

  it('renders "back online" message when online and wasOffline is true with showWhenOnline', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      wasOffline: true,
      lastOnlineAt: new Date(),
      lastOfflineAt: new Date(),
    })

    render(<OfflineBanner showWhenOnline />)

    expect(screen.getByText(/Back online/)).toBeInTheDocument()
  })

  it('does not render "back online" message when wasOffline is false', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      wasOffline: false,
      lastOnlineAt: new Date(),
      lastOfflineAt: null,
    })

    const { container } = render(<OfflineBanner showWhenOnline />)

    expect(container.firstChild).toBeNull()
  })

  it('renders with correct styling for offline state', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: false,
      wasOffline: true,
      lastOnlineAt: null,
      lastOfflineAt: new Date(),
    })

    render(<OfflineBanner />)

    const banner = screen.getByText(/You're offline/).closest('div')
    expect(banner).toHaveClass('bg-amber-500')
  })

  it('renders with correct styling for back online state', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      wasOffline: true,
      lastOnlineAt: new Date(),
      lastOfflineAt: new Date(),
    })

    render(<OfflineBanner showWhenOnline />)

    const banner = screen.getByText(/Back online/).closest('div')
    expect(banner).toHaveClass('bg-green-500')
  })
})
