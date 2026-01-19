/**
 * Unit tests for MessageBasedTripCreator component
 * Tests user interactions, API calls, and UI updates
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MessageBasedTripCreator from '@/components/trip/MessageBasedTripCreator'
import { useRouter } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}))

// Mock fetch
global.fetch = jest.fn()

describe('MessageBasedTripCreator', () => {
  let mockPush: jest.Mock
  let mockRouter: any

  beforeEach(() => {
    mockPush = jest.fn()
    mockRouter = { push: mockPush }
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Rendering', () => {
    it('should render the form with textarea and submit button', () => {
      render(<MessageBasedTripCreator />)

      expect(screen.getByLabelText(/describe your trip/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create trip/i })).toBeInTheDocument()
    })

    it('should show update mode when tripId is provided', () => {
      render(<MessageBasedTripCreator tripId="trip-123" />)

      expect(screen.getByLabelText(/update trip details/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /update trip/i })).toBeInTheDocument()
    })

    it('should have disabled submit button when textarea is empty', () => {
      render(<MessageBasedTripCreator />)

      const button = screen.getByRole('button', { name: /create trip/i })
      expect(button).toBeDisabled()
    })

    it('should enable submit button when textarea has content', async () => {
      const user = userEvent.setup()
      render(<MessageBasedTripCreator />)

      const textarea = screen.getByLabelText(/describe your trip/i)
      await user.type(textarea, 'Trip to Paris')

      const button = screen.getByRole('button', { name: /create trip/i })
      expect(button).toBeEnabled()
    })
  })

  describe('Form Submission', () => {
    it('should call API with message on submit', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        trip: {
          id: 'trip-123',
          destination: 'Paris, France',
          start_date: '2026-03-15',
          end_date: '2026-03-20'
        },
        travelers: [],
        flights: [],
        hotels: [],
        parsed: {}
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      render(<MessageBasedTripCreator />)

      const textarea = screen.getByLabelText(/describe your trip/i)
      await user.type(textarea, 'Trip to Paris March 15-20')

      const button = screen.getByRole('button', { name: /create trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/ai/parse-trip',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Trip to Paris March 15-20' })
          })
        )
      })
    })

    it('should show loading state during submission', async () => {
      const user = userEvent.setup()

      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<MessageBasedTripCreator />)

      const textarea = screen.getByLabelText(/describe your trip/i)
      await user.type(textarea, 'Trip to Paris')

      const button = screen.getByRole('button', { name: /create trip/i })
      await user.click(button)

      expect(screen.getByText(/processing/i)).toBeInTheDocument()
      expect(button).toBeDisabled()
    })

    it('should display success message after successful creation', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        trip: {
          id: 'trip-123',
          destination: 'Tokyo, Japan',
          start_date: '2026-04-10',
          end_date: '2026-04-17'
        },
        travelers: [
          { id: '1', name: 'John', age: 35 },
          { id: '2', name: 'Jane', age: 32 }
        ],
        flights: [],
        hotels: [],
        parsed: {}
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      render(<MessageBasedTripCreator />)

      const textarea = screen.getByLabelText(/describe your trip/i)
      await user.type(textarea, 'Trip to Tokyo April 10-17 with John and Jane')

      const button = screen.getByRole('button', { name: /create trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText(/trip created!/i)).toBeInTheDocument()
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument()
        expect(screen.getByText(/john/i)).toBeInTheDocument()
        expect(screen.getByText(/jane/i)).toBeInTheDocument()
      })
    })

    it('should clear textarea after successful submission', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        trip: { id: 'trip-123', destination: 'Paris', start_date: '2026-03-15', end_date: '2026-03-20' },
        travelers: [],
        flights: [],
        hotels: [],
        parsed: {}
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      render(<MessageBasedTripCreator />)

      const textarea = screen.getByLabelText(/describe your trip/i) as HTMLTextAreaElement
      await user.type(textarea, 'Trip to Paris')

      const button = screen.getByRole('button', { name: /create trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(textarea.value).toBe('')
      })
    })

    it('should navigate to trip page after creation', async () => {
      jest.useFakeTimers()
      const user = userEvent.setup({ delay: null })

      const mockResponse = {
        trip: { id: 'trip-123', destination: 'Paris', start_date: '2026-03-15', end_date: '2026-03-20' },
        travelers: [],
        flights: [],
        hotels: [],
        parsed: {}
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      render(<MessageBasedTripCreator />)

      const textarea = screen.getByLabelText(/describe your trip/i)
      await user.type(textarea, 'Trip to Paris')

      const button = screen.getByRole('button', { name: /create trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText(/trip created!/i)).toBeInTheDocument()
      })

      jest.advanceTimersByTime(1500)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/trips/trip-123')
      })

      jest.useRealTimers()
    })

    it('should call onTripCreated callback if provided', async () => {
      const user = userEvent.setup()
      const onTripCreated = jest.fn()
      const mockResponse = {
        trip: { id: 'trip-123', destination: 'Paris', start_date: '2026-03-15', end_date: '2026-03-20' },
        travelers: [],
        flights: [],
        hotels: [],
        parsed: {}
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      render(<MessageBasedTripCreator onTripCreated={onTripCreated} />)

      const textarea = screen.getByLabelText(/describe your trip/i)
      await user.type(textarea, 'Trip to Paris')

      const button = screen.getByRole('button', { name: /create trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(onTripCreated).toHaveBeenCalledWith('trip-123')
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API returns error', async () => {
      const user = userEvent.setup()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Could not extract required trip details' })
      })

      render(<MessageBasedTripCreator />)

      const textarea = screen.getByLabelText(/describe your trip/i)
      await user.type(textarea, 'Incomplete message')

      const button = screen.getByRole('button', { name: /create trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText(/could not extract required trip details/i)).toBeInTheDocument()
      })
    })

    it('should display error when textarea is empty on submit', async () => {
      const user = userEvent.setup()
      render(<MessageBasedTripCreator />)

      // Try to submit empty form by removing disabled attribute
      const form = screen.getByRole('button', { name: /create trip/i }).closest('form')
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(screen.getByText(/please enter a message/i)).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup()

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<MessageBasedTripCreator />)

      const textarea = screen.getByLabelText(/describe your trip/i)
      await user.type(textarea, 'Trip to Paris')

      const button = screen.getByRole('button', { name: /create trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Trip Details Display', () => {
    it('should display all trip details after successful parsing', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        trip: {
          id: 'trip-123',
          destination: 'Barcelona, Spain',
          start_date: '2026-07-01',
          end_date: '2026-07-07'
        },
        travelers: [
          { id: '1', name: 'John', age: 30 },
          { id: '2', name: 'Sarah' }
        ],
        flights: [
          {
            id: 'f1',
            airline: 'Iberia',
            flight_number: 'IB123',
            from_location: 'Madrid',
            to_location: 'Barcelona',
            departure_time: '2026-07-01T10:00:00',
            arrival_time: '2026-07-01T11:00:00'
          }
        ],
        hotels: [
          {
            id: 'h1',
            name: 'Hotel Barcelona',
            check_in_date: '2026-07-01',
            check_out_date: '2026-07-07',
            address: '123 Main St'
          }
        ],
        parsed: {}
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      render(<MessageBasedTripCreator />)

      const textarea = screen.getByLabelText(/describe your trip/i)
      await user.type(textarea, 'Complex trip message')

      const button = screen.getByRole('button', { name: /create trip/i })
      await user.click(button)

      await waitFor(() => {
        // Check destination
        expect(screen.getByText('Barcelona, Spain')).toBeInTheDocument()

        // Check travelers
        expect(screen.getByText(/john/i)).toBeInTheDocument()
        expect(screen.getByText(/sarah/i)).toBeInTheDocument()

        // Check flights
        expect(screen.getByText(/Iberia IB123/i)).toBeInTheDocument()

        // Check hotels
        expect(screen.getByText(/Hotel Barcelona/i)).toBeInTheDocument()
      })
    })
  })

  describe('Update Mode', () => {
    it('should include tripId in API request when updating', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        trip: { id: 'trip-123', destination: 'New York', start_date: '2026-05-01', end_date: '2026-05-05' },
        travelers: [],
        flights: [],
        hotels: [],
        parsed: {}
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      render(<MessageBasedTripCreator tripId="trip-123" />)

      const textarea = screen.getByLabelText(/update trip details/i)
      await user.type(textarea, 'Change to New York')

      const button = screen.getByRole('button', { name: /update trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/ai/parse-trip',
          expect.objectContaining({
            body: JSON.stringify({ message: 'Change to New York', tripId: 'trip-123' })
          })
        )
      })
    })

    it('should show "Trip Updated!" message in update mode', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        trip: { id: 'trip-123', destination: 'London', start_date: '2026-06-01', end_date: '2026-06-05' },
        travelers: [],
        flights: [],
        hotels: [],
        parsed: {}
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      render(<MessageBasedTripCreator tripId="trip-123" />)

      const textarea = screen.getByLabelText(/update trip details/i)
      await user.type(textarea, 'Update details')

      const button = screen.getByRole('button', { name: /update trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText(/trip updated!/i)).toBeInTheDocument()
      })
    })

    it('should not navigate after update (only on create)', async () => {
      jest.useFakeTimers()
      const user = userEvent.setup({ delay: null })
      const mockResponse = {
        trip: { id: 'trip-123', destination: 'London', start_date: '2026-06-01', end_date: '2026-06-05' },
        travelers: [],
        flights: [],
        hotels: [],
        parsed: {}
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      render(<MessageBasedTripCreator tripId="trip-123" />)

      const textarea = screen.getByLabelText(/update trip details/i)
      await user.type(textarea, 'Update details')

      const button = screen.getByRole('button', { name: /update trip/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText(/trip updated!/i)).toBeInTheDocument()
      })

      jest.advanceTimersByTime(2000)

      expect(mockPush).not.toHaveBeenCalled()

      jest.useRealTimers()
    })
  })
})
