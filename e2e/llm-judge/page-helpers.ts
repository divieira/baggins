/**
 * Page Object helpers for E2E tests.
 *
 * All Playwright interactions are routed through these helpers so the
 * actual selectors / URLs / text patterns live in app-config.ts.
 * To adapt tests to a different app, change app-config.ts and (if the
 * interaction flow differs) these helpers — the spec files stay the same.
 */

import { Page, expect, Locator } from '@playwright/test';
import { ROUTES, SELECTORS, AUTH, TIMEOUTS } from './app-config';

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function login(page: Page): Promise<void> {
  await page.goto(ROUTES.home);

  // Fill email
  if ('role' in SELECTORS.emailInput) {
    await page.getByRole(SELECTORS.emailInput.role as any, { name: SELECTORS.emailInput.name }).fill(AUTH.email);
  }

  // Fill password
  if ('label' in SELECTORS.passwordInput) {
    await page.getByLabel(SELECTORS.passwordInput.label).fill(AUTH.password);
  }

  // Click sign in
  await page.getByRole(
    SELECTORS.signInButton.role as any,
    { name: SELECTORS.signInButton.name }
  ).click();

  await page.waitForURL(ROUTES.dashboardPattern, { timeout: TIMEOUTS.login });
}

// ─── Trip Creation ──────────────────────────────────────────────────────────

/**
 * Navigate to the trip creation page and wait for the input to be ready.
 */
export async function navigateToTripCreation(page: Page): Promise<void> {
  await page.goto(ROUTES.tripCreate);
  await expect(page.locator(SELECTORS.tripMessageInput)).toBeVisible({
    timeout: TIMEOUTS.pageLoad,
  });
}

/**
 * Fill the trip description and submit. Returns the newly created trip ID.
 */
export async function createTrip(page: Page, message: string): Promise<string> {
  const textarea = page.locator(SELECTORS.tripMessageInput);
  await textarea.fill(message);

  await page.getByRole(
    SELECTORS.tripSubmitButton.role as any,
    { name: SELECTORS.tripSubmitButton.name }
  ).click();

  await page.waitForURL(ROUTES.tripDetail, { timeout: TIMEOUTS.tripCreation });

  const match = page.url().match(ROUTES.tripDetail);
  if (!match) throw new Error(`Could not extract trip ID from URL: ${page.url()}`);
  return match[1];
}

/**
 * Login, navigate to trip creation, create a trip. Convenience combo.
 */
export async function loginAndCreateTrip(page: Page, message: string): Promise<string> {
  await login(page);
  await navigateToTripCreation(page);
  return createTrip(page, message);
}

// ─── Itinerary Navigation ───────────────────────────────────────────────────

/**
 * Open the itinerary / timeline view if a toggle button exists.
 * Returns true if the view was toggled, false if already visible or not found.
 */
export async function openItineraryView(page: Page): Promise<boolean> {
  const btn = page.getByRole(
    SELECTORS.viewItineraryButton.role as any,
    { name: SELECTORS.viewItineraryButton.name }
  );
  if (await btn.isVisible({ timeout: TIMEOUTS.elementVisibility }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(TIMEOUTS.selectionUpdate);
    return true;
  }
  return false;
}

// ─── Time Block Interactions ────────────────────────────────────────────────

/**
 * Get all time block containers on the page.
 */
export function getTimeBlocks(page: Page): Locator {
  return page.locator(SELECTORS.timeBlockContainer);
}

/**
 * Get suggestion cards within a specific time block.
 */
export function getSuggestionCards(block: Locator): Locator {
  return block.locator(SELECTORS.suggestionCard);
}

/**
 * Get the title text of a suggestion card.
 */
export async function getCardTitle(card: Locator): Promise<string | null> {
  return card.locator(SELECTORS.cardTitle).textContent().catch(() => null);
}

/**
 * Click the "Select" button on a suggestion card, if visible.
 * Returns true if selection was made.
 */
export async function selectCard(card: Locator, page: Page): Promise<boolean> {
  const btn = card.getByRole(
    SELECTORS.selectButton.role as any,
    { name: SELECTORS.selectButton.name }
  );
  if (await btn.isVisible({ timeout: TIMEOUTS.selectionUpdate }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(TIMEOUTS.shortWait);
    return true;
  }
  return false;
}

/**
 * Click the "Clear" button in a time block, if visible.
 * Returns true if clear was performed.
 */
export async function clearSelection(block: Locator, page: Page): Promise<boolean> {
  const btn = block.getByRole(
    SELECTORS.clearButton.role as any,
    { name: SELECTORS.clearButton.name }
  );
  if (await btn.isVisible({ timeout: TIMEOUTS.selectionUpdate }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(TIMEOUTS.shortWait);
    return true;
  }
  return false;
}

/**
 * Count how many "Selected" badges are visible in a time block.
 */
export async function countSelections(block: Locator): Promise<number> {
  return block.locator(SELECTORS.selectedBadge).count();
}

/**
 * Check if a "Selected" badge is visible in a locator scope.
 */
export async function hasSelection(scope: Locator): Promise<boolean> {
  return scope.locator(SELECTORS.selectedBadge)
    .isVisible({ timeout: TIMEOUTS.selectionUpdate })
    .catch(() => false);
}

// ─── Plan Modification ──────────────────────────────────────────────────────

/**
 * Submit a modification request through whatever input is available on the page.
 * Tries multiple selector strategies from app-config.
 * Throws if no modification input is found.
 */
export async function submitModification(page: Page, request: string): Promise<void> {
  let inputFound = false;

  // Try each candidate selector
  for (const selector of SELECTORS.modificationInputCandidates) {
    const input = page.locator(selector).last();
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill(request);
      inputFound = true;
      await clickModificationSubmit(page, input);
      break;
    }
  }

  // Fallback to generic text input
  if (!inputFound) {
    const fallback = page.locator(SELECTORS.modificationInputFallback).last();
    if (await fallback.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fallback.fill(request);
      inputFound = true;
      await clickModificationSubmit(page, fallback);
    }
  }

  if (!inputFound) {
    throw new Error('Could not find modification input on the page');
  }

  // Wait for AI modification to process
  await page.waitForTimeout(TIMEOUTS.aiResponse);
}

async function clickModificationSubmit(page: Page, input: Locator): Promise<void> {
  const btn = page.getByRole(
    SELECTORS.modificationSubmitButton.role as any,
    { name: SELECTORS.modificationSubmitButton.name }
  );
  if (await btn.isVisible({ timeout: TIMEOUTS.selectionUpdate }).catch(() => false)) {
    await btn.click();
  } else {
    await input.press('Enter');
  }
}

// ─── Dashboard Navigation ───────────────────────────────────────────────────

/**
 * Get trip links from the dashboard (excluding "new" / "message" links).
 */
export function getTripLinks(page: Page): Locator {
  return page.locator(SELECTORS.tripLink).filter({
    hasNotText: SELECTORS.tripLinkExcludePattern,
  });
}

/**
 * Navigate to the first existing trip on the dashboard.
 * Returns false if no trips exist.
 */
export async function navigateToFirstTrip(page: Page): Promise<boolean> {
  await page.goto(ROUTES.dashboard);
  const links = getTripLinks(page);
  if ((await links.count()) === 0) return false;
  await links.first().click();
  await page.waitForURL(ROUTES.tripDetail);
  return true;
}

// ─── Screenshots ────────────────────────────────────────────────────────────

export async function captureScreenshotBase64(page: Page, fullPage = false): Promise<string> {
  const buffer = await page.screenshot({ fullPage });
  return buffer.toString('base64');
}
