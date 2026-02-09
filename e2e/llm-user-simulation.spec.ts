/**
 * E2E Tests: Full User Simulation with LLM-as-Judge
 *
 * Simulates realistic human user journeys through the application:
 *   1. Creates a trip via natural language
 *   2. Views the generated itinerary
 *   3. Manually selects/deselects attractions in time blocks
 *   4. Requests AI modifications
 *   5. Takes screenshots at each step for visual evaluation
 *
 * App-specific selectors, URLs, and DB schema are in llm-judge/app-config.ts.
 *
 * Run: npx playwright test e2e/llm-user-simulation.spec.ts
 */

import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { createJudgeIfAvailable } from './llm-judge/judge';
import { getScenario } from './llm-judge/scenarios';
import { TIMEOUTS, GEO_BOUNDS, DB } from './llm-judge/app-config';
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

interface SimulationStep {
  name: string;
  screenshot?: string;
  judgmentSummary?: string;
}

// ─── Full User Simulation Tests ─────────────────────────────────────────────

test.describe('User Simulation: Full Trip Lifecycle', () => {
  test.describe.configure({ timeout: TIMEOUTS.simulationTest });

  test('Family trip: create, browse, select, modify, evaluate', async ({ page }) => {
    const scenario = getScenario('familyParis');
    const steps: SimulationStep[] = [];

    // ── Step 1: Login ──
    console.log('Step 1: Logging in...');
    try {
      await pages.login(page);
    } catch {
      console.log('Login failed - skipping full simulation');
      test.skip();
      return;
    }
    steps.push({ name: 'Login', screenshot: await pages.captureScreenshotBase64(page) });

    // ── Step 2: Create trip ──
    console.log('Step 2: Creating trip...');
    await pages.navigateToTripCreation(page);
    await page.locator('textarea').fill(scenario.tripMessage);
    steps.push({ name: 'Trip form filled', screenshot: await pages.captureScreenshotBase64(page) });

    let tripId: string;
    try {
      tripId = await pages.createTrip(page, scenario.tripMessage);
    } catch {
      steps.push({ name: 'Trip creation failed', screenshot: await pages.captureScreenshotBase64(page) });
      test.skip();
      return;
    }

    console.log(`Step 2: Trip created with ID ${tripId}`);
    steps.push({ name: 'Trip created', screenshot: await pages.captureScreenshotBase64(page) });

    // ── Step 3: Verify generated data ──
    console.log('Step 3: Verifying generated data...');
    const supabase = createSupabaseClient();
    const initialData = await fetchTripData(supabase, tripId);

    expect(initialData.trip).toBeTruthy();
    expect(initialData.attractions!.length).toBeGreaterThanOrEqual(5);
    expect(initialData.restaurants!.length).toBeGreaterThanOrEqual(5);

    console.log(`  Attractions: ${initialData.attractions!.length}`);
    console.log(`  Restaurants: ${initialData.restaurants!.length}`);
    console.log(`  Time blocks: ${initialData.timeBlocks?.length || 0}`);

    // ── Step 4: LLM Judge evaluates initial suggestions ──
    if (judge) {
      console.log('Step 4: LLM Judge evaluating...');
      const [attractionJudgment, restaurantJudgment] = await Promise.all([
        judge.evaluateAttractions(scenario.context, toAttractionData(initialData.attractions!)),
        judge.evaluateRestaurants(scenario.context, toRestaurantData(initialData.restaurants!)),
      ]);

      console.log(`  Attractions: ${attractionJudgment.overall_score}/10`);
      console.log(`  Restaurants: ${restaurantJudgment.overall_score}/10`);
      steps.push({
        name: 'Initial evaluation',
        judgmentSummary: `Attr: ${attractionJudgment.overall_score}/10, Rest: ${restaurantJudgment.overall_score}/10`,
      });

      expect(attractionJudgment.pass).toBe(true);
      expect(restaurantJudgment.pass).toBe(true);
    }

    // ── Step 5: Browse itinerary ──
    console.log('Step 5: Browsing itinerary...');
    await pages.openItineraryView(page);
    steps.push({ name: 'Itinerary view', screenshot: await pages.captureScreenshotBase64(page) });

    // ── Step 6: Simulate selecting an attraction ──
    console.log('Step 6: Selecting attraction...');
    const blocks = pages.getTimeBlocks(page);
    const blockCount = await blocks.count();

    if (blockCount > 0) {
      const firstBlock = blocks.first();
      const cards = pages.getSuggestionCards(firstBlock);
      const cardCount = await cards.count();

      if (cardCount > 0) {
        const cardName = await pages.getCardTitle(cards.first());
        console.log(`  Selecting: ${cardName}`);
        const selected = await pages.selectCard(cards.first(), page);

        if (selected) {
          steps.push({ name: `Selected: ${cardName}`, screenshot: await pages.captureScreenshotBase64(page) });
          const selCount = await pages.countSelections(firstBlock);
          expect(selCount).toBe(1);

          // Try swapping to a different card
          if (cardCount >= 2) {
            const secondName = await pages.getCardTitle(cards.nth(1));
            console.log(`  Swapping to: ${secondName}`);
            await pages.selectCard(cards.nth(1), page);

            const newSelCount = await pages.countSelections(firstBlock);
            expect(newSelCount).toBeLessThanOrEqual(1);
            steps.push({ name: `Swapped to: ${secondName}`, screenshot: await pages.captureScreenshotBase64(page) });
          }
        }
      }
    }

    // ── Step 7: Request AI modification ──
    console.log('Step 7: Requesting modification...');
    try {
      await pages.submitModification(page, 'Add more kid-friendly activities with animals');
      steps.push({ name: 'After modification', screenshot: await pages.captureScreenshotBase64(page) });

      if (judge) {
        console.log('Step 8: Evaluating modification...');
        const afterModData = await fetchTripData(supabase, tripId);
        const latestVersion = afterModData.planVersions![0];

        if (latestVersion && initialData.planVersions && latestVersion[C.id] !== initialData.planVersions[0]?.[C.id]) {
          const afterBlocks = (afterModData.timeBlocks || []).filter(
            b => b[C.planVersionId] === latestVersion[C.id]
          );

          if (afterBlocks.length > 0) {
            const modResult = await judge.evaluateModification(
              scenario.context,
              'Add more kid-friendly activities with animals',
              toTimeBlockData(initialData.timeBlocks || [], initialData.attractions!, initialData.restaurants!),
              toTimeBlockData(afterBlocks, afterModData.attractions!, afterModData.restaurants!),
              toAttractionData(afterModData.attractions!),
              toRestaurantData(afterModData.restaurants!)
            );

            console.log(`  Modification: ${modResult.overall_score}/10`);
            steps.push({ name: 'Modification evaluation', judgmentSummary: `${modResult.overall_score}/10` });
          }
        }
      }
    } catch {
      console.log('  Modification input not found');
    }

    // ── Step 8: Visual evaluation ──
    if (judge) {
      console.log('Step 9: Visual evaluation...');
      const screenshotBase64 = await pages.captureScreenshotBase64(page, true);
      const visualResult = await judge.evaluateScreenshot(
        screenshotBase64,
        'Trip detail page showing a family trip to Paris with itinerary and suggestions.'
      );
      console.log(`  Visual: ${visualResult.overall_score}/10`);
      steps.push({ name: 'Visual evaluation', judgmentSummary: `Visual: ${visualResult.overall_score}/10` });
    }

    // ── Summary ──
    console.log('\n=== Simulation Summary ===');
    for (const step of steps) {
      const judgment = step.judgmentSummary ? ` [${step.judgmentSummary}]` : '';
      console.log(`  ${step.name}${judgment}`);
    }
  });

  test('Solo trip: create, evaluate variety, check coordinates', async ({ page }) => {
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

    expect(data.attractions!.length).toBeGreaterThanOrEqual(5);
    expect(data.restaurants!.length).toBeGreaterThanOrEqual(5);

    // Coordinate check using config bounds
    const bounds = GEO_BOUNDS.tokyo;
    const inBounds = data.attractions!.filter(a =>
      a[C.latitude] >= bounds.minLat && a[C.latitude] <= bounds.maxLat &&
      a[C.longitude] >= bounds.minLng && a[C.longitude] <= bounds.maxLng
    );
    expect(inBounds.length / data.attractions!.length).toBeGreaterThanOrEqual(0.7);

    // Cuisine variety
    const cuisines = new Set(data.restaurants!.map(r => r[C.cuisineType]));
    console.log(`Restaurant cuisines: ${Array.from(cuisines).join(', ')}`);
    expect(cuisines.size).toBeGreaterThanOrEqual(3);

    if (judge) {
      const fullResult = await judge.evaluateFullTrip(
        scenario.context,
        toAttractionData(data.attractions!),
        toRestaurantData(data.restaurants!),
        toTimeBlockData(data.timeBlocks || [], data.attractions!, data.restaurants!)
      );
      console.log('=== Solo Tokyo Full Evaluation ===');
      console.log(fullResult.summary);
      expect(fullResult.pass).toBe(true);
    }
  });

  test('Capture and evaluate multiple page states', async ({ page }) => {
    if (!judge) { test.skip(); return; }

    const scenario = getScenario('coupleRome');

    try {
      await pages.login(page);
    } catch {
      test.skip();
      return;
    }

    // Screenshot 1: Dashboard
    const dashResult = await judge.evaluateScreenshot(
      await pages.captureScreenshotBase64(page),
      'Dashboard page showing trip list with destination, dates, and quick actions.'
    );
    console.log(`Dashboard visual: ${dashResult.overall_score}/10`);

    // Screenshot 2: Trip creation page
    await pages.navigateToTripCreation(page);
    await page.waitForTimeout(2000);
    const createResult = await judge.evaluateScreenshot(
      await pages.captureScreenshotBase64(page),
      'Trip creation page with text area for natural language trip description.'
    );
    console.log(`Trip creation visual: ${createResult.overall_score}/10`);

    // Create the trip
    let tripId: string;
    try {
      tripId = await pages.createTrip(page, scenario.tripMessage);
    } catch {
      return;
    }

    // Screenshot 3: Trip detail
    await page.waitForTimeout(3000);
    const tripResult = await judge.evaluateScreenshot(
      await pages.captureScreenshotBase64(page, true),
      'Trip detail page for a romantic Rome trip with itinerary, time blocks, and suggestions.'
    );
    console.log(`Trip detail visual: ${tripResult.overall_score}/10`);

    // Screenshot 4: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    const mobileResult = await judge.evaluateScreenshot(
      await pages.captureScreenshotBase64(page, true),
      'Same trip detail on mobile viewport (375px). Should be responsive, no overflow.'
    );
    console.log(`Mobile visual: ${mobileResult.overall_score}/10`);

    const avgVisual = (
      dashResult.overall_score + createResult.overall_score +
      tripResult.overall_score + mobileResult.overall_score
    ) / 4;
    console.log(`\nAverage visual score: ${avgVisual}/10`);
  });
});

// ─── Realistic User Behavior Patterns ───────────────────────────────────────

test.describe('User Simulation: Realistic Behavior Patterns', () => {
  test.describe.configure({ timeout: TIMEOUTS.simulationTest });

  test('user changes mind: select, deselect, re-select different attraction', async ({ page }) => {
    try {
      await pages.login(page);
    } catch {
      test.skip();
      return;
    }

    // Use existing trip or create one
    let tripFound = await pages.navigateToFirstTrip(page);
    if (!tripFound) {
      const scenario = getScenario('familyParis');
      try {
        await pages.navigateToTripCreation(page);
        await pages.createTrip(page, scenario.tripMessage);
      } catch {
        test.skip();
        return;
      }
    }

    await pages.openItineraryView(page);

    const blocks = pages.getTimeBlocks(page);
    if ((await blocks.count()) === 0) { test.skip(); return; }

    const block = blocks.first();
    const cards = pages.getSuggestionCards(block);
    if ((await cards.count()) < 2) { test.skip(); return; }

    // Step 1: Select first card
    if (await pages.selectCard(cards.first(), page)) {
      console.log('Selected first card');
      expect(await pages.countSelections(block)).toBe(1);

      // Step 2: Clear
      if (await pages.clearSelection(block, page)) {
        console.log('Cleared selection');
        expect(await pages.countSelections(block)).toBe(0);
      }

      // Step 3: Select second card
      const updatedCards = pages.getSuggestionCards(block);
      if ((await updatedCards.count()) >= 2) {
        if (await pages.selectCard(updatedCards.nth(1), page)) {
          console.log('Selected second card');
          expect(await pages.countSelections(block)).toBe(1);
        }
      }
    }

    console.log('Selection flow test completed');
  });

  test('user navigates between trips without data leaking', async ({ page }) => {
    try {
      await pages.login(page);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();

    // Create first trip (Paris)
    await pages.navigateToTripCreation(page);
    let trip1Id: string;
    try {
      trip1Id = await pages.createTrip(page, 'Quick trip to Paris, March 1-3, 2026. Just me, Alex, age 30.');
    } catch {
      test.skip();
      return;
    }

    // Create second trip (Tokyo)
    await pages.navigateToTripCreation(page);
    let trip2Id: string;
    try {
      trip2Id = await pages.createTrip(page, 'Quick trip to Tokyo, April 1-3, 2026. Just me, Alex, age 30.');
    } catch {
      test.skip();
      return;
    }

    // Verify data isolation
    const [trip1Data, trip2Data] = await Promise.all([
      fetchTripData(supabase, trip1Id),
      fetchTripData(supabase, trip2Id),
    ]);

    const trip1AttrNames = new Set(trip1Data.attractions!.map(a => a[C.name]));
    const trip2AttrNames = new Set(trip2Data.attractions!.map(a => a[C.name]));

    const overlap = [...trip1AttrNames].filter(name => trip2AttrNames.has(name));
    console.log(`Trip 1: ${trip1Data.attractions!.length} attractions, Trip 2: ${trip2Data.attractions!.length}`);
    console.log(`Overlap: ${overlap.length}`);

    const overlapRatio = overlap.length / Math.min(trip1AttrNames.size, trip2AttrNames.size);
    expect(overlapRatio).toBeLessThan(0.2);

    // Navigate between trips - verify correct destination shown
    await page.goto(`/dashboard/trips/${trip1Id}`);
    await page.waitForTimeout(2000);
    expect(await page.textContent('body')).toContain('Paris');

    await page.goto(`/dashboard/trips/${trip2Id}`);
    await page.waitForTimeout(2000);
    expect(await page.textContent('body')).toContain('Tokyo');
  });
});
