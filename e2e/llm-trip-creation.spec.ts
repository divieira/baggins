/**
 * E2E Tests: Trip Creation with LLM-as-Judge Evaluation
 *
 * These tests create trips through the application and use an LLM judge
 * to evaluate whether the generated suggestions (attractions, restaurants,
 * opening hours, coordinates) are sensible and appropriate.
 *
 * App-specific selectors, URLs, and DB schema are in llm-judge/app-config.ts.
 * To adapt to a different app, modify that file — test logic stays the same.
 *
 * Run: npx playwright test e2e/llm-trip-creation.spec.ts
 */

import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { createJudgeIfAvailable } from './llm-judge/judge';
import { getScenario } from './llm-judge/scenarios';
import { TIMEOUTS, BLOCK_TYPES, GEO_BOUNDS, DB } from './llm-judge/app-config';
import * as pages from './llm-judge/page-helpers';
import {
  createSupabaseClient,
  fetchTripData,
  toAttractionData,
  toRestaurantData,
  toTimeBlockData,
} from './llm-judge/db-helpers';

config({ path: '.env.test' });

const C = DB.columns;

let judge = createJudgeIfAvailable();

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Trip Creation with LLM Judge
// ─────────────────────────────────────────────────────────────────────────────

test.describe('LLM-Judged Trip Creation', () => {
  test.describe.configure({ timeout: TIMEOUTS.aiTest });

  test('Family Paris: attractions should be real, kid-friendly, and in Paris', async ({ page }) => {
    const scenario = getScenario('familyParis');
    if (!judge) { test.skip(); return; }

    const tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    expect(data.attractions).toBeTruthy();
    expect(data.attractions!.length).toBeGreaterThanOrEqual(5);
    expect(data.restaurants).toBeTruthy();
    expect(data.restaurants!.length).toBeGreaterThanOrEqual(5);

    for (const attraction of data.attractions!) {
      expect(attraction[C.name]).toBeTruthy();
      expect(attraction[C.latitude]).toBeTruthy();
      expect(attraction[C.longitude]).toBeTruthy();
    }

    const attractionResult = await judge.evaluateAttractions(
      scenario.context,
      toAttractionData(data.attractions!)
    );

    console.log('=== Attraction Judgment ===');
    console.log(`Overall: ${attractionResult.overall_score}/10 (${attractionResult.pass ? 'PASS' : 'FAIL'})`);
    console.log(`Authenticity: ${attractionResult.authenticity.score}/10 - ${attractionResult.authenticity.reasoning}`);
    console.log(`Location: ${attractionResult.location_accuracy.score}/10`);
    console.log(`Kid-friendly: ${attractionResult.kid_friendly_accuracy.score}/10`);
    if (attractionResult.issues.length > 0) {
      console.log(`Issues: ${attractionResult.issues.join('; ')}`);
    }

    expect(attractionResult.pass).toBe(true);
    expect(attractionResult.overall_score).toBeGreaterThanOrEqual(5);
    expect(attractionResult.kid_friendly_accuracy.score).toBeGreaterThanOrEqual(5);
  });

  test('Family Paris: restaurants should be real and family-friendly', async ({ page }) => {
    const scenario = getScenario('familyParis');
    if (!judge) { test.skip(); return; }

    const tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    expect(data.restaurants!.length).toBeGreaterThanOrEqual(5);

    const restaurantResult = await judge.evaluateRestaurants(
      scenario.context,
      toRestaurantData(data.restaurants!)
    );

    console.log('=== Restaurant Judgment ===');
    console.log(`Overall: ${restaurantResult.overall_score}/10 (${restaurantResult.pass ? 'PASS' : 'FAIL'})`);
    console.log(`Cuisine relevance: ${restaurantResult.cuisine_relevance.score}/10`);
    if (restaurantResult.issues.length > 0) {
      console.log(`Issues: ${restaurantResult.issues.join('; ')}`);
    }

    expect(restaurantResult.pass).toBe(true);
    expect(restaurantResult.cuisine_relevance.score).toBeGreaterThanOrEqual(5);
  });

  test('Solo Tokyo: suggestions should reflect tech/anime/food interests', async ({ page }) => {
    const scenario = getScenario('soloTokyo');
    if (!judge) { test.skip(); return; }

    const tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    const [attractionResult, restaurantResult] = await Promise.all([
      judge.evaluateAttractions(scenario.context, toAttractionData(data.attractions!)),
      judge.evaluateRestaurants(scenario.context, toRestaurantData(data.restaurants!)),
    ]);

    console.log('=== Tokyo Trip Judgment ===');
    console.log(`Attractions: ${attractionResult.overall_score}/10 (${attractionResult.pass ? 'PASS' : 'FAIL'})`);
    console.log(`Restaurants: ${restaurantResult.overall_score}/10 (${restaurantResult.pass ? 'PASS' : 'FAIL'})`);

    expect(attractionResult.pass).toBe(true);
    expect(restaurantResult.pass).toBe(true);
    expect(attractionResult.location_accuracy.score).toBeGreaterThanOrEqual(5);
    expect(attractionResult.category_variety.score).toBeGreaterThanOrEqual(5);
  });

  test('Rome: itinerary should have logical schedule and good pacing', async ({ page }) => {
    const scenario = getScenario('coupleRome');
    if (!judge) { test.skip(); return; }

    const tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    if (!data.timeBlocks || data.timeBlocks.length === 0) {
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
    console.log(`Overall: ${itineraryResult.overall_score}/10`);
    console.log(`Schedule: ${itineraryResult.schedule_logic.score}/10`);
    console.log(`Proximity: ${itineraryResult.geographic_grouping.score}/10`);
    console.log(`Meals: ${itineraryResult.meal_timing.score}/10`);
    console.log(`Pacing: ${itineraryResult.pacing.score}/10`);
    if (itineraryResult.issues.length > 0) {
      console.log(`Issues: ${itineraryResult.issues.join('; ')}`);
    }

    expect(itineraryResult.pass).toBe(true);
    expect(itineraryResult.meal_timing.score).toBeGreaterThanOrEqual(4);
  });

  test('Bangkok: budget trip should have appropriate price levels', async ({ page }) => {
    const scenario = getScenario('budgetBangkok');
    if (!judge) { test.skip(); return; }

    const tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    const restaurantResult = await judge.evaluateRestaurants(
      scenario.context,
      toRestaurantData(data.restaurants!)
    );

    console.log('=== Bangkok Budget Judgment ===');
    console.log(`Price accuracy: ${restaurantResult.price_level_accuracy.score}/10 - ${restaurantResult.price_level_accuracy.reasoning}`);

    expect(restaurantResult.pass).toBe(true);
    expect(restaurantResult.price_level_accuracy.score).toBeGreaterThanOrEqual(4);
  });

  test('Comprehensive: full trip evaluation with visual check', async ({ page }) => {
    const scenario = getScenario('familyParis');
    if (!judge) { test.skip(); return; }

    const tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    if (!data.timeBlocks || data.timeBlocks.length === 0) { test.skip(); return; }

    const fullResult = await judge.evaluateFullTrip(
      scenario.context,
      toAttractionData(data.attractions!),
      toRestaurantData(data.restaurants!),
      toTimeBlockData(data.timeBlocks, data.attractions!, data.restaurants!)
    );

    console.log('=== Comprehensive Trip Judgment ===');
    console.log(fullResult.summary);
    expect(fullResult.pass).toBe(true);

    const screenshotBase64 = await pages.captureScreenshotBase64(page, true);
    const visualResult = await judge.evaluateScreenshot(
      screenshotBase64,
      `Trip detail page for a family trip to Paris. Should show itinerary and attractions.`
    );

    console.log(`Visual: ${visualResult.overall_score}/10`);
    if (visualResult.overall_score < 5) {
      console.warn(`WARNING: Visual quality ${visualResult.overall_score}/10: ${visualResult.issues.join('; ')}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Structural Tests (no LLM judge needed, always run)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Trip Creation: Structural Validation', () => {
  test.describe.configure({ timeout: TIMEOUTS.aiTest });

  test('created trip should have required data fields', async ({ page }) => {
    const scenario = getScenario('familyParis');
    let tripId: string;
    try {
      tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    expect(data.trip).toBeTruthy();
    expect(data.trip[C.destination]).toBeTruthy();
    expect(data.trip[C.startDate]).toBeTruthy();
    expect(data.trip[C.endDate]).toBeTruthy();

    expect(data.cities).toBeTruthy();
    expect(data.cities!.length).toBeGreaterThanOrEqual(1);
    expect(data.travelers).toBeTruthy();
    expect(data.travelers!.length).toBeGreaterThanOrEqual(1);

    expect(data.attractions!.length).toBeGreaterThanOrEqual(5);
    expect(data.restaurants!.length).toBeGreaterThanOrEqual(5);

    for (const attraction of data.attractions!) {
      expect(attraction[C.name]).toBeTruthy();
      expect(typeof attraction[C.latitude]).toBe('number');
      expect(typeof attraction[C.longitude]).toBe('number');
      expect(attraction[C.description]).toBeTruthy();
    }

    for (const restaurant of data.restaurants!) {
      expect(restaurant[C.name]).toBeTruthy();
      expect(typeof restaurant[C.latitude]).toBe('number');
      expect(typeof restaurant[C.longitude]).toBe('number');
      expect(restaurant[C.cuisineType]).toBeTruthy();
    }
  });

  test('time blocks should follow correct structure', async ({ page }) => {
    const scenario = getScenario('soloTokyo');
    let tripId: string;
    try {
      tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    if (!data.timeBlocks || data.timeBlocks.length === 0) { test.skip(); return; }

    for (const block of data.timeBlocks) {
      expect(BLOCK_TYPES.all).toContain(block[C.blockType]);
      expect(block[C.date]).toBeTruthy();
      expect(block[C.startTime]).toBeTruthy();
      expect(block[C.endTime]).toBeTruthy();

      if (BLOCK_TYPES.mealBlocks.includes(block[C.blockType]) && block[C.selectedAttractionId]) {
        console.warn(`WARNING: ${block[C.blockType]} block on ${block[C.date]} has attraction instead of restaurant`);
      }
      if (BLOCK_TYPES.activityBlocks.includes(block[C.blockType]) && block[C.selectedRestaurantId]) {
        console.warn(`WARNING: ${block[C.blockType]} block on ${block[C.date]} has restaurant instead of attraction`);
      }
    }

    // No duplicate attraction assignments
    const usedAttractionIds = data.timeBlocks
      .filter(b => b[C.selectedAttractionId])
      .map(b => b[C.selectedAttractionId]);
    expect(new Set(usedAttractionIds).size).toBe(usedAttractionIds.length);

    // No duplicate restaurant assignments
    const usedRestaurantIds = data.timeBlocks
      .filter(b => b[C.selectedRestaurantId])
      .map(b => b[C.selectedRestaurantId]);
    expect(new Set(usedRestaurantIds).size).toBe(usedRestaurantIds.length);
  });

  test('coordinates should be in the correct geographic region', async ({ page }) => {
    const scenario = getScenario('coupleRome');
    let tripId: string;
    try {
      tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    const bounds = GEO_BOUNDS.rome;
    let outOfBoundsCount = 0;
    for (const attraction of data.attractions!) {
      const lat = attraction[C.latitude];
      const lng = attraction[C.longitude];
      if (lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng) {
        outOfBoundsCount++;
        console.warn(`Out of bounds: ${attraction[C.name]} at (${lat}, ${lng})`);
      }
    }

    const inBoundsRatio = 1 - outOfBoundsCount / data.attractions!.length;
    expect(inBoundsRatio).toBeGreaterThanOrEqual(0.8);
  });
});
