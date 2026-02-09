/**
 * Types for the LLM-as-Judge E2E evaluation system.
 *
 * The judge uses Claude to evaluate whether AI-generated trip data
 * (attractions, restaurants, itineraries, modifications) is sensible,
 * accurate, and appropriate for the given trip context.
 */

export interface JudgmentScore {
  score: number; // 0-10
  reasoning: string;
}

export interface AttractionJudgment {
  authenticity: JudgmentScore; // Are these real places?
  location_accuracy: JudgmentScore; // Coordinates in the right city?
  hours_sensibility: JudgmentScore; // Opening hours make sense?
  category_variety: JudgmentScore; // Good mix of categories?
  kid_friendly_accuracy: JudgmentScore; // Kid ratings appropriate?
  description_quality: JudgmentScore; // Descriptions helpful?
  overall_score: number;
  pass: boolean;
  issues: string[];
}

export interface RestaurantJudgment {
  authenticity: JudgmentScore; // Real/plausible restaurants?
  cuisine_relevance: JudgmentScore; // Cuisines match destination?
  price_level_accuracy: JudgmentScore; // Price levels reasonable?
  hours_sensibility: JudgmentScore; // Hours make sense?
  variety: JudgmentScore; // Good mix of cuisines/price levels?
  overall_score: number;
  pass: boolean;
  issues: string[];
}

export interface ItineraryJudgment {
  schedule_logic: JudgmentScore; // Activities during opening hours?
  geographic_grouping: JudgmentScore; // Nearby places same day?
  meal_timing: JudgmentScore; // Meals at right times?
  pacing: JudgmentScore; // Not too rushed or empty?
  day_variety: JudgmentScore; // Variety across days?
  overall_score: number;
  pass: boolean;
  issues: string[];
}

export interface ModificationJudgment {
  request_fulfilled: JudgmentScore; // Does modification address request?
  change_minimality: JudgmentScore; // Targeted changes, not rewrite?
  logical_coherence: JudgmentScore; // Plan still makes sense?
  improvement_quality: JudgmentScore; // Is the plan actually better?
  overall_score: number;
  pass: boolean;
  issues: string[];
}

export interface ScreenshotJudgment {
  visual_clarity: JudgmentScore; // Is the UI readable?
  information_display: JudgmentScore; // Is key info visible?
  layout_quality: JudgmentScore; // Is layout logical?
  overall_score: number;
  pass: boolean;
  issues: string[];
}

export interface ComprehensiveJudgment {
  attractions: AttractionJudgment;
  restaurants: RestaurantJudgment;
  itinerary: ItineraryJudgment;
  overall_score: number;
  pass: boolean;
  summary: string;
}

// Data structures passed to the judge

export interface AttractionData {
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  opening_time: string | null;
  closing_time: string | null;
  duration_minutes: number | null;
  is_kid_friendly: boolean;
  min_age: number | null;
  highlights: string[];
}

export interface RestaurantData {
  name: string;
  description: string;
  cuisine_type: string;
  latitude: number;
  longitude: number;
  opening_time: string | null;
  closing_time: string | null;
  price_level: number;
  is_kid_friendly: boolean;
  highlights: string[];
}

export interface TimeBlockData {
  date: string;
  block_type: string;
  start_time: string;
  end_time: string;
  attraction_name: string | null;
  restaurant_name: string | null;
}

export interface TripContext {
  destination: string;
  start_date: string;
  end_date: string;
  travelers: { name: string; age?: number }[];
  cities?: { name: string; start_date: string; end_date: string }[];
}

export interface TestScenario {
  name: string;
  description: string;
  tripMessage: string;
  context: TripContext;
  expectedTraits: string[]; // What the judge should check for
  modificationRequests?: string[]; // Follow-up modifications to test
}

export const PASS_THRESHOLD = 6.0; // Minimum overall score to pass
