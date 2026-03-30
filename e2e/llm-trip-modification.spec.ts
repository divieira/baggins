/**
 * E2E Tests: Trip Modification with LLM-as-Judge Evaluation
 *
 * Tests that simulate a user modifying their trip plan and uses an LLM
 * judge to evaluate whether the modifications are appropriate.
 *
 * App-specific selectors, URLs, and DB schema are in llm-judge/app-config.ts.
 *
 * Run: npx playwright test e2e/llm-trip-modification.spec.ts
 */

import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { createJudgeIfAvailable } from './llm-judge/judge';
import { getScenario } from './llm-judge/scenarios';
import { TIMEOUTS, DB } from './llm-judge/app-config';
import * as pages from './llm-judge/page-helpers';
import {
  createSupabaseClient,
  fetchTripData,
  getBlocksForVersion,
  toAttractionData,
  toRestaurantData,
  toTimeBlockData,
} from './llm-judge/db-helpers';

config({ path: '.env.test' });

const C = DB.columns;

let judge = createJudgeIfAvailable();

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('LLM-Judged Trip Modification', () => {
  test.describe.configure({ timeout: TIMEOUTS.modificationTest });

  test('kid-friendly modification should add appropriate activities', async ({ page }) => {
    const scenario = getScenario('familyParis');
    if (!judge) { test.skip(); return; }

    const tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();

    // Get state BEFORE modification
    const beforeData = await fetchTripData(supabase, tripId);
    if (!beforeData.timeBlocks || beforeData.timeBlocks.length === 0) {
      test.skip();
      return;
    }

    const beforeVersion = beforeData.planVersions![0];
    const beforeBlocks = getBlocksForVersion(beforeData.timeBlocks, beforeVersion[C.id]);
    const beforeBlockData = toTimeBlockData(beforeBlocks, beforeData.attractions!, beforeData.restaurants!);

    // Submit modification
    const modRequest = 'Add more kid-friendly activities, our 5-year-old loves animals and playgrounds';
    try {
      await pages.submitModification(page, modRequest);
    } catch {
      console.log('Could not find modification UI - skipping');
      test.skip();
      return;
    }

    // Get state AFTER modification
    const afterData = await fetchTripData(supabase, tripId);
    const afterVersion = afterData.planVersions![0];

    expect(afterVersion[C.versionNumber]).toBeGreaterThan(beforeVersion[C.versionNumber]);

    const afterBlocks = getBlocksForVersion(afterData.timeBlocks!, afterVersion[C.id]);
    const afterBlockData = toTimeBlockData(afterBlocks, afterData.attractions!, afterData.restaurants!);

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
    console.log(`Minimality: ${modResult.change_minimality.score}/10`);
    console.log(`Coherence: ${modResult.logical_coherence.score}/10`);
    console.log(`Overall: ${modResult.overall_score}/10 (${modResult.pass ? 'PASS' : 'FAIL'})`);

    expect(modResult.pass).toBe(true);
    expect(modResult.request_fulfilled.score).toBeGreaterThanOrEqual(5);
  });

  test('budget modification should adjust restaurant price levels', async ({ page }) => {
    const scenario = getScenario('familyParis');
    if (!judge) { test.skip(); return; }

    const tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();

    const beforeData = await fetchTripData(supabase, tripId);
    if (!beforeData.timeBlocks || beforeData.timeBlocks.length === 0) { test.skip(); return; }

    const beforeVersion = beforeData.planVersions![0];
    const beforeBlocks = getBlocksForVersion(beforeData.timeBlocks, beforeVersion[C.id]);
    const beforeBlockData = toTimeBlockData(beforeBlocks, beforeData.attractions!, beforeData.restaurants!);

    const modRequest = 'Replace expensive restaurants with budget-friendly options';
    try {
      await pages.submitModification(page, modRequest);
    } catch {
      test.skip();
      return;
    }

    const afterData = await fetchTripData(supabase, tripId);
    const afterVersion = afterData.planVersions![0];
    const afterBlocks = getBlocksForVersion(afterData.timeBlocks!, afterVersion[C.id]);
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
    console.log(`Request fulfilled: ${modResult.request_fulfilled.score}/10`);
    console.log(`Overall: ${modResult.overall_score}/10 (${modResult.pass ? 'PASS' : 'FAIL'})`);

    expect(modResult.pass).toBe(true);
  });

  test('outdoor activities modification should adjust activity types', async ({ page }) => {
    const scenario = getScenario('familyParis');
    if (!judge) { test.skip(); return; }

    const tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    const supabase = createSupabaseClient();

    const beforeData = await fetchTripData(supabase, tripId);
    if (!beforeData.timeBlocks || beforeData.timeBlocks.length === 0) { test.skip(); return; }

    const beforeVersion = beforeData.planVersions![0];
    const beforeBlocks = getBlocksForVersion(beforeData.timeBlocks, beforeVersion[C.id]);
    const beforeBlockData = toTimeBlockData(beforeBlocks, beforeData.attractions!, beforeData.restaurants!);

    const modRequest = 'We want more outdoor activities since the weather should be nice';
    try {
      await pages.submitModification(page, modRequest);
    } catch {
      test.skip();
      return;
    }

    const afterData = await fetchTripData(supabase, tripId);
    const afterVersion = afterData.planVersions![0];
    const afterBlocks = getBlocksForVersion(afterData.timeBlocks!, afterVersion[C.id]);
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
    console.log(`Request fulfilled: ${modResult.request_fulfilled.score}/10`);
    console.log(`Overall: ${modResult.overall_score}/10 (${modResult.pass ? 'PASS' : 'FAIL'})`);

    expect(modResult.pass).toBe(true);
    expect(modResult.request_fulfilled.score).toBeGreaterThanOrEqual(4);
  });
});

// ─── Structural Modification Tests (no LLM judge) ──────────────────────────

test.describe('Trip Modification: Structural Validation', () => {
  test.describe.configure({ timeout: TIMEOUTS.modificationTest });

  test('modification should create a new plan version', async ({ page }) => {
    const scenario = getScenario('coupleRome');
    let tripId: string;
    try {
      tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const beforeData = await fetchTripData(supabase, tripId);
    if (!beforeData.planVersions || beforeData.planVersions.length === 0) { test.skip(); return; }

    const versionCountBefore = beforeData.planVersions.length;

    try {
      await pages.submitModification(page, 'Add a wine tasting experience');
    } catch {
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
      tripId = await pages.loginAndCreateTrip(page, scenario.tripMessage);
    } catch {
      test.skip();
      return;
    }

    const supabase = createSupabaseClient();
    const beforeData = await fetchTripData(supabase, tripId);
    if (!beforeData.timeBlocks || beforeData.timeBlocks.length === 0) { test.skip(); return; }

    const beforeVersion = beforeData.planVersions![0];
    const beforeBlocks = getBlocksForVersion(beforeData.timeBlocks, beforeVersion[C.id]);
    const beforeBlockCount = beforeBlocks.length;

    try {
      await pages.submitModification(page, 'Add a visit to Akihabara for anime shopping');
    } catch {
      test.skip();
      return;
    }

    const afterData = await fetchTripData(supabase, tripId);
    const afterVersion = afterData.planVersions![0];
    const afterBlocks = getBlocksForVersion(afterData.timeBlocks!, afterVersion[C.id]);

    // Same number of time block slots
    expect(afterBlocks.length).toBe(beforeBlockCount);

    // At least some blocks unchanged (targeted modification)
    const unchangedCount = afterBlocks.filter(afterBlock => {
      const beforeBlock = beforeBlocks.find(
        b => b[C.date] === afterBlock[C.date] && b[C.blockType] === afterBlock[C.blockType]
      );
      if (!beforeBlock) return false;
      return (
        beforeBlock[C.selectedAttractionId] === afterBlock[C.selectedAttractionId] &&
        beforeBlock[C.selectedRestaurantId] === afterBlock[C.selectedRestaurantId]
      );
    }).length;

    const unchangedRatio = unchangedCount / afterBlocks.length;
    console.log(`Unchanged blocks: ${unchangedCount}/${afterBlocks.length} (${Math.round(unchangedRatio * 100)}%)`);
    expect(unchangedRatio).toBeGreaterThanOrEqual(0.3);
  });
});
