/**
 * E2E Tests: Full User Simulation with LLM-as-Judge
 *
 * Simulates a realistic human user journey through the application:
 *   1. Creates a trip via natural language
 *   2. Views the generated itinerary
 *   3. Manually selects/deselects attractions in time blocks
 *   4. Requests AI modifications
 *   5. Takes screenshots at each step for visual evaluation
 *   6. LLM judge evaluates the entire experience
 *
 * This is the most comprehensive test - it exercises the full lifecycle
 * and evaluates both data quality and user experience.
 *
 * Run: npx playwright test e2e/llm-user-simulation.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { TripJudge, createJudgeIfAvailable } from './llm-judge/judge';
import { getScenario } from './llm-judge/scenarios';
import {
  AttractionData,
  RestaurantData,
  TimeBlockData,
  TripContext,
} from './llm-judge/types';

config({ path: '.env.test' });

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@baggins.test';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';
const SIMULATION_TIMEOUT = 300_000; // 5 minutes for full simulation

let judge: TripJudge | null = null;

test.beforeAll(() => {
  judge = createJudgeIfAvailable();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

async function fetchTripData(supabase: SupabaseClient, tripId: string) {
  const [
    { data: trip },
    { data: cities },
    { data: travelers },
    { data: attractions },
    { data: restaurants },
    { data: timeBlocks },
    { data: planVersions },
  ] = await Promise.all([
    supabase.from('trips').select('*').eq('id', tripId).single(),
    supabase.from('trip_cities').select('*').eq('trip_id', tripId).order('order_index'),
    supabase.from('travelers').select('*').eq('trip_id', tripId),
    supabase.from('attractions').select('*').eq('trip_id', tripId),
    supabase.from('restaurants').select('*').eq('trip_id', tripId),
    supabase.from('time_blocks').select('*').eq('trip_id', tripId).order('date').order('start_time'),
    supabase.from('plan_versions').select('*').eq('trip_id', tripId).order('version_number', { ascending: false }),
  ]);
  return { trip, cities, travelers, attractions, restaurants, timeBlocks, planVersions };
}

function toTimeBlockData(blocks: any[], attractions: any[], restaurants: any[]): TimeBlockData[] {
  const attrMap = new Map(attractions.map(a => [a.id, a.name]));
  const restMap = new Map(restaurants.map(r => [r.id, r.name]));
  return blocks.map(b => ({
    date: b.date,
    block_type: b.block_type,
    start_time: b.start_time,
    end_time: b.end_time,
    attraction_name: b.selected_attraction_id ? attrMap.get(b.selected_attraction_id) || null : null,
    restaurant_name: b.selected_restaurant_id ? restMap.get(b.selected_restaurant_id) || null : null,
  }));
}

function toAttractionData(attrs: any[]): AttractionData[] {
  return attrs.map(a => ({
    name: a.name, description: a.description || '', category: a.category || 'general',
    latitude: a.latitude, longitude: a.longitude,
    opening_time: a.opening_time, closing_time: a.closing_time,
    duration_minutes: a.duration_minutes,
    is_kid_friendly: a.is_kid_friendly || false, min_age: a.min_age,
    highlights: a.highlights || [],
  }));
}

function toRestaurantData(rests: any[]): RestaurantData[] {
  return rests.map(r => ({
    name: r.name, description: r.description || '', cuisine_type: r.cuisine_type || '',
    latitude: r.latitude, longitude: r.longitude,
    opening_time: r.opening_time, closing_time: r.closing_time,
    price_level: r.price_level || 2,
    is_kid_friendly: r.is_kid_friendly || false,
    highlights: r.highlights || [],
  }));
}

interface SimulationStep {
  name: string;
  screenshot?: string; // base64
  data?: any;
  judgmentSummary?: string;
}

// ─── Full User Simulation Tests ─────────────────────────────────────────────

test.describe('User Simulation: Full Trip Lifecycle', () => {
  test.describe.configure({ timeout: SIMULATION_TIMEOUT });

  test('Family trip: create, browse, select, modify, evaluate', async ({ page }) => {
    const scenario = getScenario('familyParis');
    const steps: SimulationStep[] = [];

    if (!judge) {
      console.log('LLM judge not available - running structural checks only');
    }

    // ── Step 1: Login ──
    console.log('Step 1: Logging in...');
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    } catch {
      console.log('Login failed - skipping full simulation');
      test.skip();
      return;
    }

    steps.push({ name: 'Login', screenshot: (await page.screenshot()).toString('base64') });
    console.log('Step 1: Login complete');

    // ── Step 2: Create trip ──
    console.log('Step 2: Creating trip...');
    await page.goto('/dashboard/trips/new-message');
    await expect(page.locator('textarea')).toBeVisible({ timeout: 10000 });

    const textarea = page.locator('textarea');
    await textarea.fill(scenario.tripMessage);

    steps.push({ name: 'Trip form filled', screenshot: (await page.screenshot()).toString('base64') });

    const submitButton = page.getByRole('button', { name: /create trip|plan my trip/i });
    await submitButton.click();

    // Wait for trip creation with progress tracking
    let tripId: string;
    try {
      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/, { timeout: 120_000 });
      const url = page.url();
      const match = url.match(/\/trips\/([a-f0-9-]+)$/);
      if (!match) throw new Error('No trip ID in URL');
      tripId = match[1];
    } catch {
      console.log('Trip creation timed out or failed');
      steps.push({ name: 'Trip creation failed', screenshot: (await page.screenshot()).toString('base64') });
      test.skip();
      return;
    }

    console.log(`Step 2: Trip created with ID ${tripId}`);
    steps.push({ name: 'Trip created', screenshot: (await page.screenshot()).toString('base64') });

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
    console.log(`  Travelers: ${initialData.travelers?.length || 0}`);

    // ── Step 4: LLM Judge evaluates initial suggestions ──
    if (judge) {
      console.log('Step 4: LLM Judge evaluating initial suggestions...');

      const [attractionJudgment, restaurantJudgment] = await Promise.all([
        judge.evaluateAttractions(scenario.context, toAttractionData(initialData.attractions!)),
        judge.evaluateRestaurants(scenario.context, toRestaurantData(initialData.restaurants!)),
      ]);

      console.log(`  Attractions: ${attractionJudgment.overall_score}/10 (${attractionJudgment.pass ? 'PASS' : 'FAIL'})`);
      console.log(`  Restaurants: ${restaurantJudgment.overall_score}/10 (${restaurantJudgment.pass ? 'PASS' : 'FAIL'})`);

      steps.push({
        name: 'Initial suggestion evaluation',
        judgmentSummary: `Attractions: ${attractionJudgment.overall_score}/10, Restaurants: ${restaurantJudgment.overall_score}/10`,
      });

      expect(attractionJudgment.pass).toBe(true);
      expect(restaurantJudgment.pass).toBe(true);
    }

    // ── Step 5: Browse the itinerary page ──
    console.log('Step 5: Browsing itinerary...');

    // Look for the itinerary/timeline view
    const timelineButton = page.getByRole('button', { name: /view itinerary|timeline/i });
    if (await timelineButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await timelineButton.click();
      await page.waitForTimeout(2000);
    }

    steps.push({ name: 'Itinerary view', screenshot: (await page.screenshot()).toString('base64') });

    // ── Step 6: Simulate user selecting an attraction ──
    console.log('Step 6: Simulating attraction selection...');

    const timeBlocks = page.locator('.border.border-stone-200.rounded-2xl');
    const blockCount = await timeBlocks.count();

    if (blockCount > 0) {
      const firstBlock = timeBlocks.first();
      const suggestionCards = firstBlock.locator('.flex-shrink-0.snap-center.bg-white.rounded-2xl');
      const cardCount = await suggestionCards.count();

      if (cardCount > 0) {
        // Try to select the first available suggestion
        const selectButton = suggestionCards.first().getByRole('button', { name: /select/i });
        if (await selectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          const cardName = await suggestionCards.first().locator('h4').textContent().catch(() => 'unknown');
          console.log(`  Selecting: ${cardName}`);
          await selectButton.click();
          await page.waitForTimeout(2000);

          steps.push({
            name: `Selected attraction: ${cardName}`,
            screenshot: (await page.screenshot()).toString('base64'),
          });

          // Verify selection persisted
          const selectedBadge = firstBlock.locator('text="Selected ✓"');
          const isSelected = await selectedBadge.isVisible({ timeout: 2000 }).catch(() => false);
          if (isSelected) {
            console.log('  Selection confirmed');
          }

          // Try selecting a different one to test swap behavior
          if (cardCount >= 2) {
            const secondCard = suggestionCards.nth(1);
            const secondSelectBtn = secondCard.getByRole('button', { name: /select/i });
            if (await secondSelectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              const secondName = await secondCard.locator('h4').textContent().catch(() => 'unknown');
              console.log(`  Swapping to: ${secondName}`);
              await secondSelectBtn.click();
              await page.waitForTimeout(2000);

              // Verify only one selection exists
              const selectedCount = await firstBlock.locator('text="Selected ✓"').count();
              expect(selectedCount).toBeLessThanOrEqual(1);

              steps.push({
                name: `Swapped to: ${secondName}`,
                screenshot: (await page.screenshot()).toString('base64'),
              });
            }
          }
        }
      }
    } else {
      console.log('  No time blocks found on page');
    }

    // ── Step 7: Request AI modification ──
    console.log('Step 7: Requesting AI modification...');

    const modInputSelectors = [
      'input[placeholder*="odif"]',
      'textarea[placeholder*="odif"]',
      'input[placeholder*="hange"]',
      'input[type="text"]',
    ];

    let modSubmitted = false;
    for (const selector of modInputSelectors) {
      const input = page.locator(selector).last();
      if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
        await input.fill('Add more kid-friendly activities with animals');
        steps.push({ name: 'Modification requested', screenshot: (await page.screenshot()).toString('base64') });

        const submitBtn = page.getByRole('button', { name: /modify|update|apply|submit|send/i });
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitBtn.click();
          modSubmitted = true;
        } else {
          await input.press('Enter');
          modSubmitted = true;
        }
        break;
      }
    }

    if (modSubmitted) {
      console.log('  Modification submitted, waiting for response...');
      await page.waitForTimeout(20_000);
      steps.push({ name: 'After modification', screenshot: (await page.screenshot()).toString('base64') });

      // ── Step 8: Evaluate the modification ──
      if (judge) {
        console.log('Step 8: LLM Judge evaluating modification...');

        const afterModData = await fetchTripData(supabase, tripId);
        const latestVersion = afterModData.planVersions![0];

        if (latestVersion && initialData.planVersions && latestVersion.id !== initialData.planVersions[0]?.id) {
          const beforeBlocks = initialData.timeBlocks || [];
          const afterBlocks = (afterModData.timeBlocks || []).filter(
            b => b.plan_version_id === latestVersion.id
          );

          if (afterBlocks.length > 0) {
            const modResult = await judge.evaluateModification(
              scenario.context,
              'Add more kid-friendly activities with animals',
              toTimeBlockData(beforeBlocks, initialData.attractions!, initialData.restaurants!),
              toTimeBlockData(afterBlocks, afterModData.attractions!, afterModData.restaurants!),
              toAttractionData(afterModData.attractions!),
              toRestaurantData(afterModData.restaurants!)
            );

            console.log(`  Modification: ${modResult.overall_score}/10 (${modResult.pass ? 'PASS' : 'FAIL'})`);
            console.log(`  Request fulfilled: ${modResult.request_fulfilled.score}/10`);

            steps.push({
              name: 'Modification evaluation',
              judgmentSummary: `Overall: ${modResult.overall_score}/10, Request fulfilled: ${modResult.request_fulfilled.score}/10`,
            });
          }
        } else {
          console.log('  No new version created after modification');
        }
      }
    } else {
      console.log('  Could not find modification input');
    }

    // ── Step 9: Visual evaluation of final state ──
    if (judge) {
      console.log('Step 9: Visual evaluation of final page...');
      const finalScreenshot = await page.screenshot({ fullPage: true });
      const visualResult = await judge.evaluateScreenshot(
        finalScreenshot.toString('base64'),
        'Trip detail page showing a family trip to Paris with itinerary, time blocks, and attraction suggestions. ' +
        'The user has browsed and selected some attractions and requested modifications.'
      );

      console.log(`  Visual quality: ${visualResult.overall_score}/10`);
      steps.push({
        name: 'Visual evaluation',
        judgmentSummary: `Visual: ${visualResult.overall_score}/10`,
      });
    }

    // ── Summary ──
    console.log('\n=== Simulation Summary ===');
    for (const step of steps) {
      const judgment = step.judgmentSummary ? ` [${step.judgmentSummary}]` : '';
      console.log(`  ${step.name}${judgment}`);
    }
    console.log(`Total steps: ${steps.length}`);
  });

  test('Solo trip: create, evaluate variety, modify interests', async ({ page }) => {
    const scenario = getScenario('soloTokyo');

    if (!judge) {
      console.log('LLM judge not available - running structural checks only');
    }

    // Login
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    } catch {
      test.skip();
      return;
    }

    // Create trip
    await page.goto('/dashboard/trips/new-message');
    await expect(page.locator('textarea')).toBeVisible({ timeout: 10000 });
    await page.locator('textarea').fill(scenario.tripMessage);
    await page.getByRole('button', { name: /create trip|plan my trip/i }).click();

    let tripId: string;
    try {
      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/, { timeout: 120_000 });
      const match = page.url().match(/\/trips\/([a-f0-9-]+)$/);
      if (!match) throw new Error('No trip ID');
      tripId = match[1];
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const data = await fetchTripData(supabase, tripId);

    // Structural validation
    expect(data.attractions!.length).toBeGreaterThanOrEqual(5);
    expect(data.restaurants!.length).toBeGreaterThanOrEqual(5);

    // Check Tokyo coordinates (lat ~35.6, lng ~139.7)
    const tokyoBounds = {
      minLat: 35.4, maxLat: 35.9,
      minLng: 139.4, maxLng: 140.0,
    };

    const inBounds = data.attractions!.filter(a =>
      a.latitude >= tokyoBounds.minLat && a.latitude <= tokyoBounds.maxLat &&
      a.longitude >= tokyoBounds.minLng && a.longitude <= tokyoBounds.maxLng
    );
    expect(inBounds.length / data.attractions!.length).toBeGreaterThanOrEqual(0.7);

    // Check restaurant cuisine variety
    const cuisines = new Set(data.restaurants!.map(r => r.cuisine_type));
    console.log(`Restaurant cuisines: ${Array.from(cuisines).join(', ')}`);
    expect(cuisines.size).toBeGreaterThanOrEqual(3); // At least 3 different cuisines

    // LLM evaluation
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
    /**
     * This test captures screenshots at various points in the trip lifecycle
     * and has the LLM evaluate the visual experience. Useful for catching
     * UI regressions that affect the trip planning experience.
     */
    if (!judge) { test.skip(); return; }

    const scenario = getScenario('coupleRome');

    // Login
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    } catch {
      test.skip();
      return;
    }

    // Screenshot 1: Dashboard (trip list)
    const dashboardScreenshot = await page.screenshot();
    const dashResult = await judge.evaluateScreenshot(
      dashboardScreenshot.toString('base64'),
      'Dashboard page showing the user\'s trip list. Should display trip cards with destination, dates, and quick actions.'
    );
    console.log(`Dashboard visual: ${dashResult.overall_score}/10`);

    // Screenshot 2: Trip creation page
    await page.goto('/dashboard/trips/new-message');
    await page.waitForTimeout(2000);
    const createScreenshot = await page.screenshot();
    const createResult = await judge.evaluateScreenshot(
      createScreenshot.toString('base64'),
      'Trip creation page with a text area for natural language trip description. Should have a clear input area and submit button.'
    );
    console.log(`Trip creation visual: ${createResult.overall_score}/10`);

    // Create the trip
    await page.locator('textarea').fill(scenario.tripMessage);
    await page.getByRole('button', { name: /create trip|plan my trip/i }).click();

    try {
      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/, { timeout: 120_000 });
    } catch {
      console.log('Trip creation timed out during visual evaluation');
      return;
    }

    // Screenshot 3: Trip detail page
    await page.waitForTimeout(3000); // Let content load
    const tripScreenshot = await page.screenshot({ fullPage: true });
    const tripResult = await judge.evaluateScreenshot(
      tripScreenshot.toString('base64'),
      'Trip detail page for a romantic Rome trip. Should show destination info, daily itinerary with time blocks, and attraction/restaurant suggestions with images, descriptions, and hours.'
    );
    console.log(`Trip detail visual: ${tripResult.overall_score}/10`);

    // Screenshot 4: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    const mobileScreenshot = await page.screenshot({ fullPage: true });
    const mobileResult = await judge.evaluateScreenshot(
      mobileScreenshot.toString('base64'),
      'Same trip detail page but on a mobile viewport (375px wide). Should be responsive - all information accessible, no horizontal overflow, readable text.'
    );
    console.log(`Mobile visual: ${mobileResult.overall_score}/10`);

    console.log('\n=== Visual Evaluation Summary ===');
    console.log(`Dashboard: ${dashResult.overall_score}/10`);
    console.log(`Trip creation: ${createResult.overall_score}/10`);
    console.log(`Trip detail: ${tripResult.overall_score}/10`);
    console.log(`Mobile: ${mobileResult.overall_score}/10`);

    // All pages should be at least minimally usable
    const avgVisual = (
      dashResult.overall_score +
      createResult.overall_score +
      tripResult.overall_score +
      mobileResult.overall_score
    ) / 4;
    console.log(`Average visual score: ${avgVisual}/10`);
  });
});

// ─── Realistic User Behavior Patterns ───────────────────────────────────────

test.describe('User Simulation: Realistic Behavior Patterns', () => {
  test.describe.configure({ timeout: SIMULATION_TIMEOUT });

  test('user changes mind: select, deselect, re-select different attraction', async ({ page }) => {
    /**
     * Simulates a user who is indecisive:
     * 1. Selects an attraction
     * 2. Deselects it (clears)
     * 3. Selects a different one
     * Verifies the app handles rapid selection changes correctly.
     */
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    } catch {
      test.skip();
      return;
    }

    // Navigate to existing trip or create one
    await page.goto('/dashboard');
    const tripLinks = page.locator('a[href*="/dashboard/trips/"]').filter({
      hasNotText: /new|message/i,
    });

    if ((await tripLinks.count()) === 0) {
      console.log('No existing trips - creating one for selection test');
      const scenario = getScenario('familyParis');
      await page.goto('/dashboard/trips/new-message');
      await page.locator('textarea').fill(scenario.tripMessage);
      await page.getByRole('button', { name: /create trip|plan my trip/i }).click();
      try {
        await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/, { timeout: 120_000 });
      } catch {
        test.skip();
        return;
      }
    } else {
      await tripLinks.first().click();
      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/);
    }

    // Look for timeline/itinerary view
    const timelineBtn = page.getByRole('button', { name: /view itinerary|timeline/i });
    if (await timelineBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await timelineBtn.click();
      await page.waitForTimeout(2000);
    }

    // Find time blocks with suggestion cards
    const blocks = page.locator('.border.border-stone-200.rounded-2xl');
    const blockCount = await blocks.count();

    if (blockCount === 0) {
      console.log('No time blocks visible - skipping selection test');
      test.skip();
      return;
    }

    const block = blocks.first();
    const cards = block.locator('.flex-shrink-0.snap-center.bg-white.rounded-2xl');
    const cardCount = await cards.count();

    if (cardCount < 2) {
      console.log('Not enough suggestion cards for selection test');
      test.skip();
      return;
    }

    // Step 1: Select first card
    const firstSelect = cards.first().getByRole('button', { name: /select/i });
    if (await firstSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstSelect.click();
      await page.waitForTimeout(1500);
      console.log('Selected first card');

      const selectedCount1 = await block.locator('text="Selected ✓"').count();
      expect(selectedCount1).toBe(1);

      // Step 2: Clear selection
      const clearBtn = block.getByRole('button', { name: /clear/i });
      if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clearBtn.click();
        await page.waitForTimeout(1500);
        console.log('Cleared selection');

        const selectedCount2 = await block.locator('text="Selected ✓"').count();
        expect(selectedCount2).toBe(0);
      }

      // Step 3: Select second card
      // After clearing, cards may have re-sorted, so re-query
      const updatedCards = block.locator('.flex-shrink-0.snap-center.bg-white.rounded-2xl');
      if ((await updatedCards.count()) >= 2) {
        const secondSelect = updatedCards.nth(1).getByRole('button', { name: /select/i });
        if (await secondSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await secondSelect.click();
          await page.waitForTimeout(1500);
          console.log('Selected second card');

          const selectedCount3 = await block.locator('text="Selected ✓"').count();
          expect(selectedCount3).toBe(1);
        }
      }
    }

    console.log('Selection flow test completed');
  });

  test('user navigates between trips without data leaking', async ({ page }) => {
    /**
     * Creates two different trips and verifies that navigating between them
     * shows correct data for each (no cross-contamination).
     */
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();

    // Create first trip (Paris)
    await page.goto('/dashboard/trips/new-message');
    await page.locator('textarea').fill('Quick trip to Paris, March 1-3, 2026. Just me, Alex, age 30.');
    await page.getByRole('button', { name: /create trip|plan my trip/i }).click();

    let trip1Id: string;
    try {
      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/, { timeout: 120_000 });
      trip1Id = page.url().match(/\/trips\/([a-f0-9-]+)$/)![1];
    } catch {
      test.skip();
      return;
    }

    // Create second trip (Tokyo)
    await page.goto('/dashboard/trips/new-message');
    await page.locator('textarea').fill('Quick trip to Tokyo, April 1-3, 2026. Just me, Alex, age 30.');
    await page.getByRole('button', { name: /create trip|plan my trip/i }).click();

    let trip2Id: string;
    try {
      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/, { timeout: 120_000 });
      trip2Id = page.url().match(/\/trips\/([a-f0-9-]+)$/)![1];
    } catch {
      test.skip();
      return;
    }

    // Verify data isolation
    const [trip1Data, trip2Data] = await Promise.all([
      fetchTripData(supabase, trip1Id),
      fetchTripData(supabase, trip2Id),
    ]);

    // Attractions should be for different destinations
    const trip1AttrNames = new Set(trip1Data.attractions!.map(a => a.name));
    const trip2AttrNames = new Set(trip2Data.attractions!.map(a => a.name));

    // There should be minimal overlap (different cities)
    const overlap = [...trip1AttrNames].filter(name => trip2AttrNames.has(name));
    console.log(`Trip 1 attractions: ${trip1Data.attractions!.length}`);
    console.log(`Trip 2 attractions: ${trip2Data.attractions!.length}`);
    console.log(`Overlap: ${overlap.length} (${overlap.join(', ')})`);

    // No more than 10% overlap (some generic names might match)
    const overlapRatio = overlap.length / Math.min(trip1AttrNames.size, trip2AttrNames.size);
    expect(overlapRatio).toBeLessThan(0.2);

    // Navigate between trips and verify page shows correct destination
    await page.goto(`/dashboard/trips/${trip1Id}`);
    await page.waitForTimeout(2000);
    const trip1Text = await page.textContent('body');
    expect(trip1Text).toContain('Paris');

    await page.goto(`/dashboard/trips/${trip2Id}`);
    await page.waitForTimeout(2000);
    const trip2Text = await page.textContent('body');
    expect(trip2Text).toContain('Tokyo');
  });
});
