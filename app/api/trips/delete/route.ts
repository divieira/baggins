import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  try {
    const { tripId } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify trip ownership (only owners can delete)
    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the trip owner can delete this trip' },
        { status: 403 }
      )
    }

    // Delete the trip - cascading deletes will handle related records
    // The database schema should have ON DELETE CASCADE for:
    // - trip_cities
    // - travelers
    // - flights
    // - hotels
    // - attractions
    // - restaurants
    // - time_blocks
    // - plan_versions
    // - trip_collaborators
    // - ai_interactions
    const { error: deleteError } = await supabase
      .from('trips')
      .delete()
      .eq('id', tripId)

    if (deleteError) {
      console.error('Error deleting trip:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete trip' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Trip deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting trip:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete trip' },
      { status: 500 }
    )
  }
}
