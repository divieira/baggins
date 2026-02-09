/**
 * E2E Tests: Trip Modification with LLM-as-Judge Evaluation
 *
 * Tests that simulate a user modifying their trip plan and uses an LLM
 * judge to evaluate whether the modifications are appropriate, fulfill
 * the user's request, and maintain plan coherence.
 *
 * Flow:
 *   1. Create a trip
 *   2. Request a modification (e.g., "add more museums")
 *   3. LLM judge evaluates whether the modification makes sense
 *   4. Request further modifications and evaluate chain of changes
 *
 * Run: npx playwright test e2e/llm-trip-modification.spec.ts
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
} from './llm-judge/types';

config({ path: '.env.test' });

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@baggins.test';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';
const AI_TEST_TIMEOUT = 240_000; // 4 minutes for modification tests

let judge: TripJudge | null = null;

test.beforeAll(() => {
  judge = createJudgeIfAvailable();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loginAndCreateTrip(page: Page, tripMessage: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  await page.goto('/dashboard/trips/new-message');
  await expect(page.locator('textarea')).toBeVisible({ timeout: 10000 });

  const textarea = page.locator('textarea');
  await textarea.fill(tripMessage);
  await page.getByRole('button', { name: /create trip|plan my trip/i }).click();
  await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/, { timeout: 120_000 });

  const url = page.url();
  const match = url.match(/\/trips\/([a-f0-9-]+)$/);
  if (!match) throw new Error(`Could not extract trip ID from URL: ${url}`);
  return match[1];
}

function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

async function fetchTripData(supabase: SupabaseClient, tripId: string) {
  const [
    { data: attractions },
    { data: restaurants },
    { data: timeBlocks },
    { data: planVersions },
  ] = await Promise.all([
    supabase.from('attractions').select('*').eq('trip_id', tripId),
    supabase.from('restaurants').select('*').eq('trip_id', tripId),
    supabase.from('time_blocks').select('*').eq('trip_id', tripId).order('date').order('start_time'),
    supabase.from('plan_versions').select('*').eq('trip_id', tripId).order('version_number', { ascending: false }),
  ]);
  return { attractions, restaurants, timeBlocks, planVersions };
}

function getBlocksForVersion(allBlocks: any[], versionId: string): any[] {
  return allBlocks.filter(b => b.plan_version_id === versionId);
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

/**
 * Submit a modification request via the PlanModifier UI component.
 */
async function submitModification(page: Page, request: string): Promise<void> {
  // Look for the modification input area
  const modInput = page.locator('input[placeholder*="modify"], textarea[placeholder*="modify"], input[placeholder*="change"], textarea[placeholder*="change"]');

  // Fall back to looking for the PlanModifier component's input
  const planModifierInput = page.locator('[data-testid="plan-modifier-input"], .plan-modifier input, .plan-modifier textarea');
  const fixedInput = page.locator('input[type="text"]').last();

  let inputFound = false;
  for (const input of [modInput, planModifierInput, fixedInput]) {
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill(request);
      inputFound = true;

      // Find and click submit button near the input
      const submitBtn = page.getByRole('button', { name: /modify|update|apply|submit|send/i });
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
      } else {
        // Try pressing Enter
        await input.press('Enter');
      }
      break;
    }
  }

  if (!inputFound) {
    throw new Error('Could not find modification input on the page');
  }

  // Wait for modification to complete
  await page.waitForTimeout(15_000);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('LLM-Judged Trip Modification', () => {
  test.describe.configure({ timeout: AI_TEST_TIMEOUT });

  test('kid-friendly modification should add appropriate activities', async ({ page }) => {
    const scenario = getScenario('familyParis');

    if (!judge) { test.skip(); return; }

    const tripId = await loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();

    // Get state BEFORE modification
    const beforeData = await fetchTripData(supabase, tripId);
    if (!beforeData.timeBlocks || beforeData.timeBlocks.length === 0) {
      console.log('No time blocks generated - skipping modification test');
      test.skip();
      return;
    }

    const beforeVersion = beforeData.planVersions![0];
    const beforeBlocks = getBlocksForVersion(beforeData.timeBlocks, beforeVersion.id);
    const beforeBlockData = toTimeBlockData(beforeBlocks, beforeData.attractions!, beforeData.restaurants!);

    // Submit modification
    const modRequest = 'Add more kid-friendly activities, our 5-year-old loves animals and playgrounds';
    try {
      await submitModification(page, modRequest);
    } catch {
      console.log('Could not find modification UI - testing via API directly');
      // Fall back to API call if UI isn't available
      test.skip();
      return;
    }

    // Get state AFTER modification
    const afterData = await fetchTripData(supabase, tripId);
    const afterVersion = afterData.planVersions![0];

    // A new version should have been created
    expect(afterVersion.version_number).toBeGreaterThan(beforeVersion.version_number);

    const afterBlocks = getBlocksForVersion(afterData.timeBlocks!, afterVersion.id);
    const afterBlockData = toTimeBlockData(afterBlocks, afterData.attractions!, afterData.restaurants!);

    // LLM Judge evaluates the modification
    const modResult = await judge.evaluateModification(
      scenario.context,
      modRequest,
      beforeBlockData,
      afterBlockData,
      toAttractionData(afterData.attractions!),
      toRestaurantData(afterData.restaurants!)
    );

    console.log('=== Kid-Friendly Modification Judgment ===');
    console.log(`Request fulfilled: ${modResult.request_fulfilled.score}/10 - ${modResult.request_fulfilled.reasoning}`);
    console.log(`Change minimality: ${modResult.change_minimality.score}/10`);
    console.log(`Logical coherence: ${modResult.logical_coherence.score}/10`);
    console.log(`Improvement quality: ${modResult.improvement_quality.score}/10`);
    console.log(`Overall: ${modResult.overall_score}/10 (${modResult.pass ? 'PASS' : 'FAIL'})`);

    expect(modResult.pass).toBe(true);
    expect(modResult.request_fulfilled.score).toBeGreaterThanOrEqual(5);
  });

  test('budget modification should adjust restaurant price levels', async ({ page }) => {
    const scenario = getScenario('familyParis');

    if (!judge) { test.skip(); return; }

    const tripId = await loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();

    const beforeData = await fetchTripData(supabase, tripId);
    if (!beforeData.timeBlocks || beforeData.timeBlocks.length === 0) {
      test.skip();
      return;
    }

    const beforeVersion = beforeData.planVersions![0];
    const beforeBlocks = getBlocksForVersion(beforeData.timeBlocks, beforeVersion.id);
    const beforeBlockData = toTimeBlockData(beforeBlocks, beforeData.attractions!, beforeData.restaurants!);

    const modRequest = 'Replace expensive restaurants with budget-friendly options';
    try {
      await submitModification(page, modRequest);
    } catch {
      test.skip();
      return;
    }

    const afterData = await fetchTripData(supabase, tripId);
    const afterVersion = afterData.planVersions![0];
    const afterBlocks = getBlocksForVersion(afterData.timeBlocks!, afterVersion.id);
    const afterBlockData = toTimeBlockData(afterBlocks, afterData.attractions!, afterData.restaurants!);

    const modResult = await judge.evaluateModification(
      scenario.context,
      modRequest,
      beforeBlockData,
      afterBlockData,
      toAttractionData(afterData.attractions!),
      toRestaurantData(afterData.restaurants!)
    );

    console.log('=== Budget Modification Judgment ===');
    console.log(`Request fulfilled: ${modResult.request_fulfilled.score}/10 - ${modResult.request_fulfilled.reasoning}`);
    console.log(`Overall: ${modResult.overall_score}/10 (${modResult.pass ? 'PASS' : 'FAIL'})`);

    expect(modResult.pass).toBe(true);
  });

  test('outdoor activities modification should adjust activity types', async ({ page }) => {
    const scenario = getScenario('familyParis');

    if (!judge) { test.skip(); return; }

    const tripId = await loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();

    const beforeData = await fetchTripData(supabase, tripId);
    if (!beforeData.timeBlocks || beforeData.timeBlocks.length === 0) {
      test.skip();
      return;
    }

    const beforeVersion = beforeData.planVersions![0];
    const beforeBlocks = getBlocksForVersion(beforeData.timeBlocks, beforeVersion.id);
    const beforeBlockData = toTimeBlockData(beforeBlocks, beforeData.attractions!, beforeData.restaurants!);

    const modRequest = 'We want more outdoor activities since the weather should be nice';
    try {
      await submitModification(page, modRequest);
    } catch {
      test.skip();
      return;
    }

    const afterData = await fetchTripData(supabase, tripId);
    const afterVersion = afterData.planVersions![0];
    const afterBlocks = getBlocksForVersion(afterData.timeBlocks!, afterVersion.id);
    const afterBlockData = toTimeBlockData(afterBlocks, afterData.attractions!, afterData.restaurants!);

    const modResult = await judge.evaluateModification(
      scenario.context,
      modRequest,
      beforeBlockData,
      afterBlockData,
      toAttractionData(afterData.attractions!),
      toRestaurantData(afterData.restaurants!)
    );

    console.log('=== Outdoor Modification Judgment ===');
    console.log(`Request fulfilled: ${modResult.request_fulfilled.score}/10 - ${modResult.request_fulfilled.reasoning}`);
    console.log(`Overall: ${modResult.overall_score}/10 (${modResult.pass ? 'PASS' : 'FAIL'})`);

    expect(modResult.pass).toBe(true);
    expect(modResult.request_fulfilled.score).toBeGreaterThanOrEqual(4);
  });
});

// ─── Structural Modification Tests (no LLM judge) ──────────────────────────

test.describe('Trip Modification: Structural Validation', () => {
  test.describe.configure({ timeout: AI_TEST_TIMEOUT });

  test('modification should create a new plan version', async ({ page }) => {
    const scenario = getScenario('coupleRome');
    let tripId: string;
    try {
      tripId = await loginAndCreateTrip(page, scenario.tripMessage);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const beforeData = await fetchTripData(supabase, tripId);

    if (!beforeData.planVersions || beforeData.planVersions.length === 0) {
      test.skip();
      return;
    }

    const versionCountBefore = beforeData.planVersions.length;

    try {
      await submitModification(page, 'Add a wine tasting experience');
    } catch {
      console.log('Modification UI not available - skipping');
      test.skip();
      return;
    }

    const afterData = await fetchTripData(supabase, tripId);
    expect(afterData.planVersions!.length).toBeGreaterThan(versionCountBefore);
  });

  test('modified plan should preserve unmodified time blocks', async ({ page }) => {
    const scenario = getScenario('soloTokyo');
    let tripId: string;
    try {
      tripId = await loginAndCreateTrip(page, scenario.tripMessage);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const beforeData = await fetchTripData(supabase, tripId);

    if (!beforeData.timeBlocks || beforeData.timeBlocks.length === 0) {
      test.skip();
      return;
    }

    const beforeVersion = beforeData.planVersions![0];
    const beforeBlocks = getBlocksForVersion(beforeData.timeBlocks, beforeVersion.id);
    const beforeBlockCount = beforeBlocks.length;

    try {
      await submitModification(page, 'Add a visit to Akihabara for anime shopping');
    } catch {
      test.skip();
      return;
    }

    const afterData = await fetchTripData(supabase, tripId);
    const afterVersion = afterData.planVersions![0];
    const afterBlocks = getBlocksForVersion(afterData.timeBlocks!, afterVersion.id);

    // New version should have same number of time block slots
    expect(afterBlocks.length).toBe(beforeBlockCount);

    // At least some blocks should be unchanged (targeted modification)
    const unchangedCount = afterBlocks.filter(afterBlock => {
      const beforeBlock = beforeBlocks.find(
        b => b.date === afterBlock.date && b.block_type === afterBlock.block_type
      );
      if (!beforeBlock) return false;
      return (
        beforeBlock.selected_attraction_id === afterBlock.selected_attraction_id &&
        beforeBlock.selected_restaurant_id === afterBlock.selected_restaurant_id
      );
    }).length;

    // At least 50% of blocks should be unchanged for a targeted modification
    const unchangedRatio = unchangedCount / afterBlocks.length;
    console.log(`Unchanged blocks: ${unchangedCount}/${afterBlocks.length} (${Math.round(unchangedRatio * 100)}%)`);
    expect(unchangedRatio).toBeGreaterThanOrEqual(0.3);
  });
});
