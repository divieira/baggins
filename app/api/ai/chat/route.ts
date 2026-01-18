import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: Request) {
  try {
    const { tripId, message } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get trip context
    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    // Get travelers
    const { data: travelers } = await supabase
      .from('travelers')
      .select('*')
      .eq('trip_id', tripId)

    // Get current attractions and restaurants
    const [{ data: attractions }, { data: restaurants }] = await Promise.all([
      supabase.from('attractions').select('*').eq('trip_id', tripId),
      supabase.from('restaurants').select('*').eq('trip_id', tripId)
    ])

    // Build context for Claude
    const context = `
Trip Details:
- Destination: ${trip.destination}
- Dates: ${trip.start_date} to ${trip.end_date}
- Travelers: ${travelers?.map((t: any) => `${t.name}${t.age ? ` (${t.age})` : ''}`).join(', ') || 'Solo'}

Current Attractions (${attractions?.length || 0}):
${attractions?.slice(0, 5).map((a: any) => `- ${a.name}: ${a.description}`).join('\n') || 'None yet'}

Current Restaurants (${restaurants?.length || 0}):
${restaurants?.slice(0, 5).map((r: any) => `- ${r.name}: ${r.description}`).join('\n') || 'None yet'}
    `.trim()

    // Get previous conversation context
    const { data: previousInteractions } = await supabase
      .from('ai_interactions')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(5)

    const conversationHistory = previousInteractions?.reverse().flatMap((interaction: any) => [
      { role: 'user' as const, content: interaction.message },
      { role: 'assistant' as const, content: interaction.response }
    ]) || []

    // Get AI response
    const aiMessage = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: `You are a helpful travel planning assistant. You help users plan their trips by suggesting attractions, restaurants, and activities based on their preferences.

${context}

Guidelines:
- Be helpful, friendly, and concise
- Make personalized suggestions based on the travelers (especially if there are kids)
- Consider the destination and trip dates
- If asked to add new suggestions, describe what would be added (but note that actual changes require generating new suggestions)
- Help users optimize their itinerary
- Be enthusiastic about travel!`,
      messages: [
        ...conversationHistory,
        { role: 'user', content: message }
      ]
    })

    const content = aiMessage.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    const response = content.text

    // Save interaction to database
    const { data: savedInteraction, error: saveError } = await supabase
      .from('ai_interactions')
      .insert({
        trip_id: tripId,
        user_id: user.id,
        message,
        response
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving interaction:', saveError)
    }

    return NextResponse.json({
      id: savedInteraction?.id || Date.now().toString(),
      response
    })
  } catch (error: any) {
    console.error('Error in AI chat:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get AI response' },
      { status: 500 }
    )
  }
}
