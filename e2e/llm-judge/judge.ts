/**
 * LLM-as-Judge: Uses Claude to evaluate trip data quality.
 *
 * This module calls the Anthropic API to assess whether AI-generated
 * trip suggestions, itineraries, and modifications are sensible and
 * appropriate. It acts as an automated "travel expert reviewer."
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AttractionData,
  RestaurantData,
  TimeBlockData,
  TripContext,
  AttractionJudgment,
  RestaurantJudgment,
  ItineraryJudgment,
  ModificationJudgment,
  ScreenshotJudgment,
  ComprehensiveJudgment,
  PASS_THRESHOLD,
} from './types';

function stripMarkdownCodeFences(text: string): string {
  const trimmed = text.trim();
  const jsonFenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (jsonFenceMatch) {
    return jsonFenceMatch[1].trim();
  }
  return trimmed;
}

export class TripJudge {
  private anthropic: Anthropic;
  private model = 'claude-sonnet-4-5';
  private passThreshold: number;

  constructor(options?: { apiKey?: string; model?: string; passThreshold?: number }) {
    const apiKey = options?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is required for LLM judge. ' +
        'Set it in .env.test or pass it to the TripJudge constructor.'
      );
    }
    this.anthropic = new Anthropic({ apiKey });
    if (options?.model) this.model = options.model;
    this.passThreshold = options?.passThreshold ?? PASS_THRESHOLD;
  }

  /**
   * Evaluate the quality of generated attraction suggestions.
   */
  async evaluateAttractions(
    context: TripContext,
    attractions: AttractionData[]
  ): Promise<AttractionJudgment> {
    const hasKids = context.travelers.some(t => t.age !== undefined && t.age < 13);
    const travelerDesc = context.travelers
      .map(t => `${t.name}${t.age ? ` (age ${t.age})` : ''}`)
      .join(', ');

    const prompt = `You are an expert travel critic and fact-checker. Evaluate these AI-generated attraction suggestions for a trip to ${context.destination}.

Trip dates: ${context.start_date} to ${context.end_date}
Travelers: ${travelerDesc}
${hasKids ? 'NOTE: This group includes children. Kid-friendliness ratings are especially important.' : ''}
${context.cities ? `Cities: ${context.cities.map(c => c.name).join(', ')}` : ''}

Attractions to evaluate:
${JSON.stringify(attractions, null, 2)}

Score each criterion from 0-10:

1. **authenticity**: Are these real, well-known places that actually exist in ${context.destination}? Deduct points for fictional places or places in the wrong city.
2. **location_accuracy**: Are the latitude/longitude coordinates approximately correct? (within ~5km of the actual location)
3. **hours_sensibility**: Do the opening/closing hours make sense for each type of venue? (museums typically 9-18, parks longer, etc.)
4. **category_variety**: Is there a good mix of categories (museums, parks, landmarks, entertainment, etc.)?
5. **kid_friendly_accuracy**: Are the is_kid_friendly ratings and min_age values appropriate? ${hasKids ? 'Are there enough kid-friendly options for this family?' : ''}
6. **description_quality**: Are descriptions accurate, informative, and helpful for trip planning?

Return ONLY valid JSON (no markdown):
{
  "authenticity": { "score": <0-10>, "reasoning": "<explanation>" },
  "location_accuracy": { "score": <0-10>, "reasoning": "<explanation>" },
  "hours_sensibility": { "score": <0-10>, "reasoning": "<explanation>" },
  "category_variety": { "score": <0-10>, "reasoning": "<explanation>" },
  "kid_friendly_accuracy": { "score": <0-10>, "reasoning": "<explanation>" },
  "description_quality": { "score": <0-10>, "reasoning": "<explanation>" },
  "issues": ["<issue1>", "<issue2>", ...],
  "overall_score": <0-10 weighted average>,
  "pass": <true if overall >= ${this.passThreshold}>
}`;

    const response = await this.callClaude(prompt);
    return this.parseJudgment<AttractionJudgment>(response);
  }

  /**
   * Evaluate the quality of generated restaurant suggestions.
   */
  async evaluateRestaurants(
    context: TripContext,
    restaurants: RestaurantData[]
  ): Promise<RestaurantJudgment> {
    const travelerDesc = context.travelers
      .map(t => `${t.name}${t.age ? ` (age ${t.age})` : ''}`)
      .join(', ');

    const prompt = `You are an expert food critic and travel consultant. Evaluate these AI-generated restaurant suggestions for a trip to ${context.destination}.

Trip dates: ${context.start_date} to ${context.end_date}
Travelers: ${travelerDesc}

Restaurants to evaluate:
${JSON.stringify(restaurants, null, 2)}

Score each criterion from 0-10:

1. **authenticity**: Are these real or plausible restaurants for ${context.destination}? Do the names sound right for the area?
2. **cuisine_relevance**: Do the cuisine types reflect ${context.destination}'s food culture? Is there a mix of local and international options?
3. **price_level_accuracy**: Are the price levels (1-4) reasonable for the area and type of restaurant?
4. **hours_sensibility**: Do opening/closing hours make sense? (restaurants typically 11-14 for lunch, 18-23 for dinner)
5. **variety**: Is there a good mix of cuisine types, price levels, and dining styles?

Return ONLY valid JSON (no markdown):
{
  "authenticity": { "score": <0-10>, "reasoning": "<explanation>" },
  "cuisine_relevance": { "score": <0-10>, "reasoning": "<explanation>" },
  "price_level_accuracy": { "score": <0-10>, "reasoning": "<explanation>" },
  "hours_sensibility": { "score": <0-10>, "reasoning": "<explanation>" },
  "variety": { "score": <0-10>, "reasoning": "<explanation>" },
  "issues": ["<issue1>", ...],
  "overall_score": <0-10 weighted average>,
  "pass": <true if overall >= ${this.passThreshold}>
}`;

    const response = await this.callClaude(prompt);
    return this.parseJudgment<RestaurantJudgment>(response);
  }

  /**
   * Evaluate the quality of a generated itinerary.
   */
  async evaluateItinerary(
    context: TripContext,
    timeBlocks: TimeBlockData[],
    attractions: AttractionData[],
    restaurants: RestaurantData[]
  ): Promise<ItineraryJudgment> {
    const travelerDesc = context.travelers
      .map(t => `${t.name}${t.age ? ` (age ${t.age})` : ''}`)
      .join(', ');

    const prompt = `You are an expert travel planner evaluating an AI-generated daily itinerary for a trip to ${context.destination}.

Trip dates: ${context.start_date} to ${context.end_date}
Travelers: ${travelerDesc}
${context.cities ? `Cities: ${context.cities.map(c => `${c.name} (${c.start_date} to ${c.end_date})`).join(', ')}` : ''}

Daily schedule (time blocks):
${JSON.stringify(timeBlocks, null, 2)}

Available attractions with hours:
${JSON.stringify(attractions.map(a => ({
  name: a.name, category: a.category,
  opening_time: a.opening_time, closing_time: a.closing_time,
  latitude: a.latitude, longitude: a.longitude,
  duration_minutes: a.duration_minutes
})), null, 2)}

Available restaurants with hours:
${JSON.stringify(restaurants.map(r => ({
  name: r.name, cuisine_type: r.cuisine_type,
  opening_time: r.opening_time, closing_time: r.closing_time,
  latitude: r.latitude, longitude: r.longitude
})), null, 2)}

Score each criterion from 0-10:

1. **schedule_logic**: Are activities scheduled during their opening hours? Are morning activities in morning blocks, lunch in lunch blocks, etc.?
2. **geographic_grouping**: Are nearby places grouped on the same day to minimize travel? Check the coordinates.
3. **meal_timing**: Are restaurants assigned to lunch (12:00-13:30) and dinner (18:00-20:00) blocks appropriately?
4. **pacing**: Is the pace reasonable? Not too many activities crammed in one day, not too many empty days?
5. **day_variety**: Does each day have a different theme or mix? Is there variety across the trip?

Return ONLY valid JSON (no markdown):
{
  "schedule_logic": { "score": <0-10>, "reasoning": "<explanation>" },
  "geographic_grouping": { "score": <0-10>, "reasoning": "<explanation>" },
  "meal_timing": { "score": <0-10>, "reasoning": "<explanation>" },
  "pacing": { "score": <0-10>, "reasoning": "<explanation>" },
  "day_variety": { "score": <0-10>, "reasoning": "<explanation>" },
  "issues": ["<issue1>", ...],
  "overall_score": <0-10 weighted average>,
  "pass": <true if overall >= ${this.passThreshold}>
}`;

    const response = await this.callClaude(prompt);
    return this.parseJudgment<ItineraryJudgment>(response);
  }

  /**
   * Evaluate whether a plan modification addresses the user's request.
   */
  async evaluateModification(
    context: TripContext,
    modificationRequest: string,
    beforeBlocks: TimeBlockData[],
    afterBlocks: TimeBlockData[],
    attractions: AttractionData[],
    restaurants: RestaurantData[]
  ): Promise<ModificationJudgment> {
    const prompt = `You are an expert travel planner evaluating whether an AI correctly modified a trip plan based on a user's request.

Destination: ${context.destination}
Trip dates: ${context.start_date} to ${context.end_date}

User's modification request: "${modificationRequest}"

BEFORE modification:
${JSON.stringify(beforeBlocks, null, 2)}

AFTER modification:
${JSON.stringify(afterBlocks, null, 2)}

Available attractions:
${JSON.stringify(attractions.map(a => ({ name: a.name, category: a.category, is_kid_friendly: a.is_kid_friendly })), null, 2)}

Available restaurants:
${JSON.stringify(restaurants.map(r => ({ name: r.name, cuisine_type: r.cuisine_type, price_level: r.price_level })), null, 2)}

Score each criterion from 0-10:

1. **request_fulfilled**: Does the modification actually address what the user asked for? If they asked for "more museums", were museums added?
2. **change_minimality**: Are changes targeted and minimal? Or did the AI unnecessarily rewrite the entire plan?
3. **logical_coherence**: Does the modified plan still make sense as a whole? No scheduling conflicts or missing meals?
4. **improvement_quality**: Is the plan objectively better after the modification? Does it feel like what a thoughtful human travel agent would do?

Return ONLY valid JSON (no markdown):
{
  "request_fulfilled": { "score": <0-10>, "reasoning": "<explanation>" },
  "change_minimality": { "score": <0-10>, "reasoning": "<explanation>" },
  "logical_coherence": { "score": <0-10>, "reasoning": "<explanation>" },
  "improvement_quality": { "score": <0-10>, "reasoning": "<explanation>" },
  "issues": ["<issue1>", ...],
  "overall_score": <0-10 weighted average>,
  "pass": <true if overall >= ${this.passThreshold}>
}`;

    const response = await this.callClaude(prompt);
    return this.parseJudgment<ModificationJudgment>(response);
  }

  /**
   * Evaluate a screenshot of the trip UI for visual quality.
   * Uses Claude's vision capability to assess the rendered page.
   */
  async evaluateScreenshot(
    screenshotBase64: string,
    pageContext: string
  ): Promise<ScreenshotJudgment> {
    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: screenshotBase64,
            },
          },
          {
            type: 'text',
            text: `You are evaluating the visual quality of a travel planning application's UI.

Page context: ${pageContext}

Score each criterion from 0-10:

1. **visual_clarity**: Is the UI clean and readable? Can you see trip information clearly?
2. **information_display**: Is key trip information (dates, destinations, attractions, times) prominently displayed?
3. **layout_quality**: Is the layout logical? Does the information flow make sense for trip planning?

Return ONLY valid JSON (no markdown):
{
  "visual_clarity": { "score": <0-10>, "reasoning": "<explanation>" },
  "information_display": { "score": <0-10>, "reasoning": "<explanation>" },
  "layout_quality": { "score": <0-10>, "reasoning": "<explanation>" },
  "issues": ["<issue1>", ...],
  "overall_score": <0-10 weighted average>,
  "pass": <true if overall >= ${this.passThreshold}>
}`,
          },
        ],
      }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');
    return this.parseJudgment<ScreenshotJudgment>(content.text);
  }

  /**
   * Run a comprehensive evaluation of an entire trip.
   */
  async evaluateFullTrip(
    context: TripContext,
    attractions: AttractionData[],
    restaurants: RestaurantData[],
    timeBlocks: TimeBlockData[]
  ): Promise<ComprehensiveJudgment> {
    // Run attraction and restaurant evaluations in parallel
    const [attractionJudgment, restaurantJudgment, itineraryJudgment] = await Promise.all([
      this.evaluateAttractions(context, attractions),
      this.evaluateRestaurants(context, restaurants),
      this.evaluateItinerary(context, timeBlocks, attractions, restaurants),
    ]);

    const overall = (
      attractionJudgment.overall_score +
      restaurantJudgment.overall_score +
      itineraryJudgment.overall_score
    ) / 3;

    return {
      attractions: attractionJudgment,
      restaurants: restaurantJudgment,
      itinerary: itineraryJudgment,
      overall_score: Math.round(overall * 10) / 10,
      pass: overall >= this.passThreshold,
      summary: `Attractions: ${attractionJudgment.overall_score}/10, ` +
        `Restaurants: ${restaurantJudgment.overall_score}/10, ` +
        `Itinerary: ${itineraryJudgment.overall_score}/10. ` +
        `Overall: ${Math.round(overall * 10) / 10}/10. ` +
        `${overall >= this.passThreshold ? 'PASS' : 'FAIL'}`,
    };
  }

  private async callClaude(prompt: string): Promise<string> {
    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from judge LLM');
    }
    return content.text;
  }

  private parseJudgment<T>(response: string): T {
    const cleaned = stripMarkdownCodeFences(response);
    try {
      return JSON.parse(cleaned) as T;
    } catch (e) {
      throw new Error(
        `Failed to parse judge response as JSON: ${e instanceof Error ? e.message : 'unknown error'}\n` +
        `Raw response: ${response.substring(0, 500)}`
      );
    }
  }
}

/**
 * Create a TripJudge instance, or return null if API key is unavailable.
 * Useful for conditional test execution.
 */
export function createJudgeIfAvailable(
  options?: { passThreshold?: number }
): TripJudge | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('LLM Judge: ANTHROPIC_API_KEY not set, judge evaluations will be skipped');
    return null;
  }
  try {
    return new TripJudge({ apiKey, ...options });
  } catch {
    return null;
  }
}
