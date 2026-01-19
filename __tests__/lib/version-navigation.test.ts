/**
 * Tests for plan version navigation logic
 */

describe('Version Navigation Logic', () => {
  type PlanVersion = {
    id: string
    version_number: number
    trip_id: string
  }

  // Simulate the navigation logic from TripTimeline
  const handleVersionChange = (
    currentVersion: PlanVersion | null,
    allVersions: PlanVersion[],
    direction: 'prev' | 'next'
  ): PlanVersion | null => {
    if (!currentVersion) return null

    const currentIndex = allVersions.findIndex(v => v.id === currentVersion.id)
    if (currentIndex === -1) return null

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
    if (newIndex >= 0 && newIndex < allVersions.length) {
      return allVersions[newIndex]
    }

    return currentVersion
  }

  it('navigates to previous version', () => {
    const versions: PlanVersion[] = [
      { id: 'v1', version_number: 1, trip_id: 'trip-1' },
      { id: 'v2', version_number: 2, trip_id: 'trip-1' },
      { id: 'v3', version_number: 3, trip_id: 'trip-1' }
    ]

    const currentVersion = versions[2] // v3
    const newVersion = handleVersionChange(currentVersion, versions, 'prev')

    expect(newVersion).toEqual(versions[1]) // Should be v2
  })

  it('navigates to next version', () => {
    const versions: PlanVersion[] = [
      { id: 'v1', version_number: 1, trip_id: 'trip-1' },
      { id: 'v2', version_number: 2, trip_id: 'trip-1' },
      { id: 'v3', version_number: 3, trip_id: 'trip-1' }
    ]

    const currentVersion = versions[0] // v1
    const newVersion = handleVersionChange(currentVersion, versions, 'next')

    expect(newVersion).toEqual(versions[1]) // Should be v2
  })

  it('stays on first version when navigating prev from v1', () => {
    const versions: PlanVersion[] = [
      { id: 'v1', version_number: 1, trip_id: 'trip-1' },
      { id: 'v2', version_number: 2, trip_id: 'trip-1' }
    ]

    const currentVersion = versions[0] // v1
    const newVersion = handleVersionChange(currentVersion, versions, 'prev')

    expect(newVersion).toEqual(currentVersion) // Should stay at v1
  })

  it('stays on last version when navigating next from final version', () => {
    const versions: PlanVersion[] = [
      { id: 'v1', version_number: 1, trip_id: 'trip-1' },
      { id: 'v2', version_number: 2, trip_id: 'trip-1' }
    ]

    const currentVersion = versions[1] // v2 (last)
    const newVersion = handleVersionChange(currentVersion, versions, 'next')

    expect(newVersion).toEqual(currentVersion) // Should stay at v2
  })

  it('returns null when current version is null', () => {
    const versions: PlanVersion[] = [
      { id: 'v1', version_number: 1, trip_id: 'trip-1' }
    ]

    const newVersion = handleVersionChange(null, versions, 'prev')

    expect(newVersion).toBeNull()
  })

  it('returns null when current version not found in list', () => {
    const versions: PlanVersion[] = [
      { id: 'v1', version_number: 1, trip_id: 'trip-1' },
      { id: 'v2', version_number: 2, trip_id: 'trip-1' }
    ]

    const currentVersion = { id: 'v99', version_number: 99, trip_id: 'trip-1' }
    const newVersion = handleVersionChange(currentVersion, versions, 'prev')

    expect(newVersion).toBeNull()
  })

  it('handles single version correctly', () => {
    const versions: PlanVersion[] = [
      { id: 'v1', version_number: 1, trip_id: 'trip-1' }
    ]

    const currentVersion = versions[0]

    // Try prev
    const prevVersion = handleVersionChange(currentVersion, versions, 'prev')
    expect(prevVersion).toEqual(currentVersion)

    // Try next
    const nextVersion = handleVersionChange(currentVersion, versions, 'next')
    expect(nextVersion).toEqual(currentVersion)
  })

  it('navigates through multiple versions in sequence', () => {
    const versions: PlanVersion[] = [
      { id: 'v1', version_number: 1, trip_id: 'trip-1' },
      { id: 'v2', version_number: 2, trip_id: 'trip-1' },
      { id: 'v3', version_number: 3, trip_id: 'trip-1' },
      { id: 'v4', version_number: 4, trip_id: 'trip-1' }
    ]

    let current = versions[0] // Start at v1

    // Navigate forward
    current = handleVersionChange(current, versions, 'next')!
    expect(current).toEqual(versions[1]) // v2

    current = handleVersionChange(current, versions, 'next')!
    expect(current).toEqual(versions[2]) // v3

    current = handleVersionChange(current, versions, 'next')!
    expect(current).toEqual(versions[3]) // v4

    // Navigate backward
    current = handleVersionChange(current, versions, 'prev')!
    expect(current).toEqual(versions[2]) // v3

    current = handleVersionChange(current, versions, 'prev')!
    expect(current).toEqual(versions[1]) // v2
  })
})
