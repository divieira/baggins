/**
 * Tests for PlanModifier component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PlanModifier from '@/components/ai/PlanModifier'

// Mock fetch
global.fetch = jest.fn()

describe('PlanModifier', () => {
  const mockOnVersionChange = jest.fn()
  const mockOnModificationComplete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockReset()
  })

  it('renders with correct version information', () => {
    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={2}
        totalVersions={3}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    expect(screen.getByText('Version 2 of 3')).toBeDefined()
  })

  it('disables prev button on first version', () => {
    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={1}
        totalVersions={3}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const prevButton = screen.getByTitle('Previous version')
    expect(prevButton).toBeDisabled()
  })

  it('disables next button on last version', () => {
    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={3}
        totalVersions={3}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const nextButton = screen.getByTitle('Next version')
    expect(nextButton).toBeDisabled()
  })

  it('calls onVersionChange when prev button clicked', () => {
    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={2}
        totalVersions={3}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const prevButton = screen.getByTitle('Previous version')
    fireEvent.click(prevButton)

    expect(mockOnVersionChange).toHaveBeenCalledWith('prev')
  })

  it('calls onVersionChange when next button clicked', () => {
    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={2}
        totalVersions={3}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const nextButton = screen.getByTitle('Next version')
    fireEvent.click(nextButton)

    expect(mockOnVersionChange).toHaveBeenCalledWith('next')
  })

  it('shows loading state when submitting modification', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true, summary: 'Changes applied' })
      }), 100))
    )

    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={1}
        totalVersions={1}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make...')
    const submitButton = screen.getByText('Update Plan')

    fireEvent.change(textarea, { target: { value: 'Add activities' } })
    fireEvent.click(submitButton)

    expect(screen.getByText('Updating Plan...')).toBeDefined()
    expect(screen.getByText('Updating your plan...')).toBeDefined()
  })

  it('submits modification request and shows success summary', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        versionId: 'version-2',
        versionNumber: 2,
        summary: 'Added kid-friendly activities to mornings'
      })
    })

    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={1}
        totalVersions={1}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make...')
    const submitButton = screen.getByText('Update Plan')

    fireEvent.change(textarea, { target: { value: 'Add kid-friendly activities to mornings' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/modify-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: 'trip-123',
          modificationRequest: 'Add kid-friendly activities to mornings'
        })
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Added kid-friendly activities to mornings')).toBeDefined()
    })

    expect(mockOnModificationComplete).toHaveBeenCalled()
  })

  it('shows error message when modification fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'No attractions available'
      })
    })

    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={1}
        totalVersions={1}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make...')
    const submitButton = screen.getByText('Update Plan')

    fireEvent.change(textarea, { target: { value: 'Add activities' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Error: No attractions available/)).toBeDefined()
    })
  })

  it('clears input after successful submission', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        summary: 'Changes applied'
      })
    })

    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={1}
        totalVersions={1}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make...') as HTMLTextAreaElement
    const submitButton = screen.getByText('Update Plan')

    fireEvent.change(textarea, { target: { value: 'Add activities' } })
    expect(textarea.value).toBe('Add activities')

    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(textarea.value).toBe('')
    })
  })

  it('disables submit button when input is empty', () => {
    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={1}
        totalVersions={1}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const submitButton = screen.getByText('Update Plan')
    expect(submitButton).toBeDisabled()
  })

  it('disables submit button and navigation during loading', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true, summary: 'Done' })
      }), 100))
    )

    render(
      <PlanModifier
        tripId="trip-123"
        currentVersionNumber={2}
        totalVersions={3}
        onVersionChange={mockOnVersionChange}
        onModificationComplete={mockOnModificationComplete}
      />
    )

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make...')
    const submitButton = screen.getByText('Update Plan')

    fireEvent.change(textarea, { target: { value: 'Add activities' } })
    fireEvent.click(submitButton)

    const prevButton = screen.getByTitle('Previous version')
    const nextButton = screen.getByTitle('Next version')

    expect(prevButton).toBeDisabled()
    expect(nextButton).toBeDisabled()
    expect(submitButton).toBeDisabled()
  })
})
