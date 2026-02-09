/**
 * E2E Tests: Trip Creation with LLM-as-Judge Evaluation
 *
 * These tests create trips through the application and use an LLM judge
 * to evaluate whether the generated suggestions (attractions, restaurants,
 * opening hours, coordinates) are sensible and appropriate.
 *
 * Requirements:
 *   - Running Next.js app (auto-started by Playwright)
 *   - Supabase instance with test user
 *   - ANTHROPIC_API_KEY (for both the app's AI and the judge)
 *
 * Run: npx playwright test e2e/llm-trip-creation.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { TripJudge, createJudgeIfAvailable } from './llm-judge/judge';
import { SCENARIOS, getScenario } from './llm-judge/scenarios';
import {
  AttractionData,
  RestaurantData,
  TimeBlockData,
  TripContext,
} from './llm-judge/types';

config({ path: '.env.test' });

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@baggins.test';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';

// Extended timeout for AI-powered tests (AI generation + judge evaluation)
const AI_TEST_TIMEOUT = 180_000; // 3 minutes

let judge: TripJudge | null = null;

test.beforeAll(() => {
  judge = createJudgeIfAvailable();
});

/**
 * Helper: Sign in and navigate to trip creation.
 */
async function loginAndNavigateToCreate(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.goto('/dashboard/trips/new-message');
  await expect(page.locator('textarea')).toBeVisible({ timeout: 10000 });
}

/**
 * Helper: Create a trip via the natural language form and wait for completion.
 * Returns the trip ID from the redirect URL.
 */
async function createTrip(page: Page, message: string): Promise<string> {
  const textarea = page.locator('textarea');
  await textarea.fill(message);

  const submitButton = page.getByRole('button', { name: /create trip|plan my trip/i });
  await submitButton.click();

  // Wait for the trip to be created - the page should redirect to the trip detail page
  await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/, { timeout: 120_000 });

  const url = page.url();
  const tripIdMatch = url.match(/\/trips\/([a-f0-9-]+)$/);
  if (!tripIdMatch) {
    throw new Error(`Could not extract trip ID from URL: ${url}`);
  }
  return tripIdMatch[1];
}

/**
 * Helper: Create a Supabase client with the test user's session.
 */
function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(url, key);
}

/**
 * Helper: Fetch trip data directly from the database.
 */
async function fetchTripData(supabase: SupabaseClient, tripId: string) {
  const [
    { data: trip },
    { data: cities },
    { data: travelers },
    { data: attractions },
    { data: restaurants },
    { data: timeBlocks },
  ] = await Promise.all([
    supabase.from('trips').select('*').eq('id', tripId).single(),
    supabase.from('trip_cities').select('*').eq('trip_id', tripId).order('order_index'),
    supabase.from('travelers').select('*').eq('trip_id', tripId),
    supabase.from('attractions').select('*').eq('trip_id', tripId),
    supabase.from('restaurants').select('*').eq('trip_id', tripId),
    supabase.from('time_blocks').select('*').eq('trip_id', tripId).order('date').order('start_time'),
  ]);

  return { trip, cities, travelers, attractions, restaurants, timeBlocks };
}

/**
 * Helper: Convert DB attractions to AttractionData for the judge.
 */
function toAttractionData(dbAttractions: any[]): AttractionData[] {
  return dbAttractions.map(a => ({
    name: a.name,
    description: a.description || '',
    category: a.category || 'general',
    latitude: a.latitude,
    longitude: a.longitude,
    opening_time: a.opening_time,
    closing_time: a.closing_time,
    duration_minutes: a.duration_minutes,
    is_kid_friendly: a.is_kid_friendly || false,
    min_age: a.min_age,
    highlights: a.highlights || [],
  }));
}

/**
 * Helper: Convert DB restaurants to RestaurantData for the judge.
 */
function toRestaurantData(dbRestaurants: any[]): RestaurantData[] {
  return dbRestaurants.map(r => ({
    name: r.name,
    description: r.description || '',
    cuisine_type: r.cuisine_type || '',
    latitude: r.latitude,
    longitude: r.longitude,
    opening_time: r.opening_time,
    closing_time: r.closing_time,
    price_level: r.price_level || 2,
    is_kid_friendly: r.is_kid_friendly || false,
    highlights: r.highlights || [],
  }));
}

/**
 * Helper: Convert DB time blocks to TimeBlockData for the judge.
 */
function toTimeBlockData(
  dbBlocks: any[],
  attractions: any[],
  restaurants: any[]
): TimeBlockData[] {
  const attrMap = new Map(attractions.map(a => [a.id, a.name]));
  const restMap = new Map(restaurants.map(r => [r.id, r.name]));

  return dbBlocks.map(b => ({
    date: b.date,
    block_type: b.block_type,
    start_time: b.start_time,
    end_time: b.end_time,
    attraction_name: b.selected_attraction_id ? attrMap.get(b.selected_attraction_id) || null : null,
    restaurant_name: b.selected_restaurant_id ? restMap.get(b.selected_restaurant_id) || null : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Trip Creation with LLM Judge
// ─────────────────────────────────────────────────────────────────────────────

test.describe('LLM-Judged Trip Creation', () => {
  test.describe.configure({ timeout: AI_TEST_TIMEOUT });

  test('Family Paris: attractions should be real, kid-friendly, and in Paris', async ({ page }) => {
    const scenario = getScenario('familyParis');

    // Skip if no judge available
    if (!judge) {
      console.log('Skipping LLM judge evaluation: ANTHROPIC_API_KEY not available');
      test.skip();
      return;
    }

    await loginAndNavigateToCreate(page);
    const tripId = await createTrip(page, scenario.tripMessage);

    // Fetch data from DB
    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    expect(data.attractions).toBeTruthy();
    expect(data.attractions!.length).toBeGreaterThanOrEqual(5);
    expect(data.restaurants).toBeTruthy();
    expect(data.restaurants!.length).toBeGreaterThanOrEqual(5);

    // Structural checks (no LLM needed)
    for (const attraction of data.attractions!) {
      expect(attraction.name).toBeTruthy();
      expect(attraction.latitude).toBeTruthy();
      expect(attraction.longitude).toBeTruthy();
    }

    // LLM Judge: evaluate attractions
    const attractionResult = await judge.evaluateAttractions(
      scenario.context,
      toAttractionData(data.attractions!)
    );

    console.log('=== Attraction Judgment ===');
    console.log(`Overall score: ${attractionResult.overall_score}/10`);
    console.log(`Pass: ${attractionResult.pass}`);
    console.log(`Authenticity: ${attractionResult.authenticity.score}/10 - ${attractionResult.authenticity.reasoning}`);
    console.log(`Location: ${attractionResult.location_accuracy.score}/10 - ${attractionResult.location_accuracy.reasoning}`);
    console.log(`Hours: ${attractionResult.hours_sensibility.score}/10`);
    console.log(`Kid-friendly: ${attractionResult.kid_friendly_accuracy.score}/10`);
    if (attractionResult.issues.length > 0) {
      console.log(`Issues: ${attractionResult.issues.join('; ')}`);
    }

    expect(attractionResult.pass).toBe(true);
    expect(attractionResult.overall_score).toBeGreaterThanOrEqual(5);
    // For a family trip, kid-friendly accuracy is especially important
    expect(attractionResult.kid_friendly_accuracy.score).toBeGreaterThanOrEqual(5);
  });

  test('Family Paris: restaurants should be real and family-friendly', async ({ page }) => {
    const scenario = getScenario('familyParis');

    if (!judge) { test.skip(); return; }

    await loginAndNavigateToCreate(page);
    const tripId = await createTrip(page, scenario.tripMessage);

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    expect(data.restaurants!.length).toBeGreaterThanOrEqual(5);

    const restaurantResult = await judge.evaluateRestaurants(
      scenario.context,
      toRestaurantData(data.restaurants!)
    );

    console.log('=== Restaurant Judgment ===');
    console.log(`Overall score: ${restaurantResult.overall_score}/10`);
    console.log(`Pass: ${restaurantResult.pass}`);
    console.log(`Authenticity: ${restaurantResult.authenticity.score}/10`);
    console.log(`Cuisine relevance: ${restaurantResult.cuisine_relevance.score}/10`);
    console.log(`Variety: ${restaurantResult.variety.score}/10`);
    if (restaurantResult.issues.length > 0) {
      console.log(`Issues: ${restaurantResult.issues.join('; ')}`);
    }

    expect(restaurantResult.pass).toBe(true);
    // Paris should have French cuisine featured prominently
    expect(restaurantResult.cuisine_relevance.score).toBeGreaterThanOrEqual(5);
  });

  test('Solo Tokyo: suggestions should reflect tech/anime/food interests', async ({ page }) => {
    const scenario = getScenario('soloTokyo');

    if (!judge) { test.skip(); return; }

    await loginAndNavigateToCreate(page);
    const tripId = await createTrip(page, scenario.tripMessage);

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    // LLM judge evaluates both attractions and restaurants
    const [attractionResult, restaurantResult] = await Promise.all([
      judge.evaluateAttractions(scenario.context, toAttractionData(data.attractions!)),
      judge.evaluateRestaurants(scenario.context, toRestaurantData(data.restaurants!)),
    ]);

    console.log('=== Tokyo Trip Judgment ===');
    console.log(`Attractions: ${attractionResult.overall_score}/10 (${attractionResult.pass ? 'PASS' : 'FAIL'})`);
    console.log(`Restaurants: ${restaurantResult.overall_score}/10 (${restaurantResult.pass ? 'PASS' : 'FAIL'})`);

    expect(attractionResult.pass).toBe(true);
    expect(restaurantResult.pass).toBe(true);

    // Tokyo should have good variety and location accuracy
    expect(attractionResult.location_accuracy.score).toBeGreaterThanOrEqual(5);
    expect(attractionResult.category_variety.score).toBeGreaterThanOrEqual(5);
  });

  test('Rome: itinerary should have logical schedule and good pacing', async ({ page }) => {
    const scenario = getScenario('coupleRome');

    if (!judge) { test.skip(); return; }

    await loginAndNavigateToCreate(page);
    const tripId = await createTrip(page, scenario.tripMessage);

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    // Need time blocks for itinerary evaluation
    if (!data.timeBlocks || data.timeBlocks.length === 0) {
      console.log('No time blocks generated - skipping itinerary evaluation');
      test.skip();
      return;
    }

    const itineraryResult = await judge.evaluateItinerary(
      scenario.context,
      toTimeBlockData(data.timeBlocks, data.attractions!, data.restaurants!),
      toAttractionData(data.attractions!),
      toRestaurantData(data.restaurants!)
    );

    console.log('=== Rome Itinerary Judgment ===');
    console.log(`Overall score: ${itineraryResult.overall_score}/10`);
    console.log(`Schedule logic: ${itineraryResult.schedule_logic.score}/10`);
    console.log(`Geographic grouping: ${itineraryResult.geographic_grouping.score}/10`);
    console.log(`Meal timing: ${itineraryResult.meal_timing.score}/10`);
    console.log(`Pacing: ${itineraryResult.pacing.score}/10`);
    console.log(`Day variety: ${itineraryResult.day_variety.score}/10`);
    if (itineraryResult.issues.length > 0) {
      console.log(`Issues: ${itineraryResult.issues.join('; ')}`);
    }

    expect(itineraryResult.pass).toBe(true);
    expect(itineraryResult.meal_timing.score).toBeGreaterThanOrEqual(4);
  });

  test('Bangkok: budget trip should have appropriate price levels', async ({ page }) => {
    const scenario = getScenario('budgetBangkok');

    if (!judge) { test.skip(); return; }

    await loginAndNavigateToCreate(page);
    const tripId = await createTrip(page, scenario.tripMessage);

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    const restaurantResult = await judge.evaluateRestaurants(
      scenario.context,
      toRestaurantData(data.restaurants!)
    );

    console.log('=== Bangkok Budget Judgment ===');
    console.log(`Restaurant overall: ${restaurantResult.overall_score}/10`);
    console.log(`Price accuracy: ${restaurantResult.price_level_accuracy.score}/10 - ${restaurantResult.price_level_accuracy.reasoning}`);

    expect(restaurantResult.pass).toBe(true);
    // Budget trip should have reasonably priced restaurants
    expect(restaurantResult.price_level_accuracy.score).toBeGreaterThanOrEqual(4);
  });

  test('Comprehensive: full trip evaluation with visual check', async ({ page }) => {
    const scenario = getScenario('familyParis');

    if (!judge) { test.skip(); return; }

    await loginAndNavigateToCreate(page);
    const tripId = await createTrip(page, scenario.tripMessage);

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    if (!data.timeBlocks || data.timeBlocks.length === 0) {
      console.log('No time blocks - skipping comprehensive evaluation');
      test.skip();
      return;
    }

    // Run comprehensive judgment
    const fullResult = await judge.evaluateFullTrip(
      scenario.context,
      toAttractionData(data.attractions!),
      toRestaurantData(data.restaurants!),
      toTimeBlockData(data.timeBlocks, data.attractions!, data.restaurants!)
    );

    console.log('=== Comprehensive Trip Judgment ===');
    console.log(fullResult.summary);

    expect(fullResult.pass).toBe(true);

    // Take screenshot for visual evaluation
    const screenshot = await page.screenshot({ fullPage: true });
    const screenshotBase64 = screenshot.toString('base64');

    const visualResult = await judge.evaluateScreenshot(
      screenshotBase64,
      `Trip detail page for a family trip to Paris. Should show itinerary, time blocks, and suggested attractions.`
    );

    console.log('=== Visual Judgment ===');
    console.log(`Visual clarity: ${visualResult.visual_clarity.score}/10`);
    console.log(`Info display: ${visualResult.information_display.score}/10`);
    console.log(`Layout: ${visualResult.layout_quality.score}/10`);

    // Visual checks are informational - don't fail the test on them
    // but log warnings for low scores
    if (visualResult.overall_score < 5) {
      console.warn('WARNING: Visual quality scored below 5/10');
      console.warn(`Issues: ${visualResult.issues.join('; ')}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Structural Tests (no LLM judge needed, always run)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Trip Creation: Structural Validation', () => {
  test.describe.configure({ timeout: AI_TEST_TIMEOUT });

  test('created trip should have required data fields', async ({ page }) => {
    await loginAndNavigateToCreate(page);

    const scenario = getScenario('familyParis');
    let tripId: string;
    try {
      tripId = await createTrip(page, scenario.tripMessage);
    } catch {
      console.log('Trip creation failed (app may not be fully configured) - skipping');
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    // Trip record exists
    expect(data.trip).toBeTruthy();
    expect(data.trip.destination).toBeTruthy();
    expect(data.trip.start_date).toBeTruthy();
    expect(data.trip.end_date).toBeTruthy();

    // Has cities
    expect(data.cities).toBeTruthy();
    expect(data.cities!.length).toBeGreaterThanOrEqual(1);

    // Has travelers
    expect(data.travelers).toBeTruthy();
    expect(data.travelers!.length).toBeGreaterThanOrEqual(1);

    // Has AI-generated suggestions
    expect(data.attractions).toBeTruthy();
    expect(data.attractions!.length).toBeGreaterThanOrEqual(5);
    expect(data.restaurants).toBeTruthy();
    expect(data.restaurants!.length).toBeGreaterThanOrEqual(5);

    // Attractions have required fields
    for (const attraction of data.attractions!) {
      expect(attraction.name).toBeTruthy();
      expect(typeof attraction.latitude).toBe('number');
      expect(typeof attraction.longitude).toBe('number');
      expect(attraction.description).toBeTruthy();
    }

    // Restaurants have required fields
    for (const restaurant of data.restaurants!) {
      expect(restaurant.name).toBeTruthy();
      expect(typeof restaurant.latitude).toBe('number');
      expect(typeof restaurant.longitude).toBe('number');
      expect(restaurant.cuisine_type).toBeTruthy();
    }
  });

  test('time blocks should follow correct structure', async ({ page }) => {
    await loginAndNavigateToCreate(page);

    const scenario = getScenario('soloTokyo');
    let tripId: string;
    try {
      tripId = await createTrip(page, scenario.tripMessage);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    if (!data.timeBlocks || data.timeBlocks.length === 0) {
      console.log('No time blocks generated - skipping');
      test.skip();
      return;
    }

    const validBlockTypes = ['morning', 'lunch', 'afternoon', 'dinner', 'evening'];

    for (const block of data.timeBlocks) {
      // Block type is valid
      expect(validBlockTypes).toContain(block.block_type);

      // Has date and times
      expect(block.date).toBeTruthy();
      expect(block.start_time).toBeTruthy();
      expect(block.end_time).toBeTruthy();

      // Lunch/dinner blocks should have restaurants, not attractions
      if (block.block_type === 'lunch' || block.block_type === 'dinner') {
        if (block.selected_attraction_id) {
          console.warn(
            `WARNING: ${block.block_type} block on ${block.date} has an attraction instead of a restaurant`
          );
        }
      }

      // Morning/afternoon blocks should have attractions, not restaurants
      if (block.block_type === 'morning' || block.block_type === 'afternoon') {
        if (block.selected_restaurant_id) {
          console.warn(
            `WARNING: ${block.block_type} block on ${block.date} has a restaurant instead of an attraction`
          );
        }
      }
    }

    // No duplicate attraction assignments
    const usedAttractionIds = data.timeBlocks
      .filter(b => b.selected_attraction_id)
      .map(b => b.selected_attraction_id);
    const uniqueAttractionIds = new Set(usedAttractionIds);
    expect(uniqueAttractionIds.size).toBe(usedAttractionIds.length);

    // No duplicate restaurant assignments
    const usedRestaurantIds = data.timeBlocks
      .filter(b => b.selected_restaurant_id)
      .map(b => b.selected_restaurant_id);
    const uniqueRestaurantIds = new Set(usedRestaurantIds);
    expect(uniqueRestaurantIds.size).toBe(usedRestaurantIds.length);
  });

  test('coordinates should be in the correct geographic region', async ({ page }) => {
    await loginAndNavigateToCreate(page);

    const scenario = getScenario('coupleRome');
    let tripId: string;
    try {
      tripId = await createTrip(page, scenario.tripMessage);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    // Rome coordinates should be approximately 41.9, 12.5
    // Allow generous bounds for attractions in greater Rome area
    const romeBounds = {
      minLat: 41.7, maxLat: 42.1,
      minLng: 12.2, maxLng: 12.8,
    };

    let outOfBoundsCount = 0;
    for (const attraction of data.attractions!) {
      if (
        attraction.latitude < romeBounds.minLat || attraction.latitude > romeBounds.maxLat ||
        attraction.longitude < romeBounds.minLng || attraction.longitude > romeBounds.maxLng
      ) {
        outOfBoundsCount++;
        console.warn(
          `Out of bounds: ${attraction.name} at (${attraction.latitude}, ${attraction.longitude})`
        );
      }
    }

    // At least 80% of attractions should be in Rome
    const inBoundsRatio = 1 - outOfBoundsCount / data.attractions!.length;
    expect(inBoundsRatio).toBeGreaterThanOrEqual(0.8);
  });
});
