import { Page, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test configuration
export const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@baggins.test';
export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';

// Create a Supabase client for direct database operations in tests
export function createTestSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables for testing');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Helper to generate unique test identifiers
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Helper to wait for navigation with retry
export async function waitForNavigation(page: Page, url: string, options?: { timeout?: number }) {
  const timeout = options?.timeout || 10000;
  await page.waitForURL(url, { timeout });
}

// Login helper - logs in a user via the UI
export async function loginUser(page: Page, email?: string, password?: string) {
  const userEmail = email || TEST_EMAIL;
  const userPassword = password || TEST_PASSWORD;

  await page.goto('/');

  // Click login tab if not already selected
  const loginTab = page.getByRole('button', { name: /login/i });
  if (await loginTab.isVisible()) {
    await loginTab.click();
  }

  // Fill in credentials
  await page.getByLabel(/email/i).fill(userEmail);
  await page.getByLabel(/^password$/i).fill(userPassword);

  // Submit
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to dashboard
  await waitForNavigation(page, '**/dashboard', { timeout: 15000 });
}

// Signup helper - creates a new user via the UI
export async function signupUser(page: Page, email?: string, password?: string) {
  const userEmail = email || TEST_EMAIL;
  const userPassword = password || TEST_PASSWORD;

  await page.goto('/');

  // Click signup tab
  const signupTab = page.getByRole('button', { name: /sign up/i });
  await signupTab.click();

  // Fill in credentials
  await page.getByLabel(/email/i).fill(userEmail);
  await page.getByLabel(/^password$/i).fill(userPassword);

  // Submit
  await page.getByRole('button', { name: /create account/i }).click();

  // Wait for success message or redirect
  await expect(page.getByText(/check your email|dashboard/i)).toBeVisible({ timeout: 15000 });
}

// Helper to cleanup test data
export async function cleanupTestData(supabase: SupabaseClient, userId?: string) {
  if (!userId) return;

  try {
    await supabase.from('trips').delete().eq('user_id', userId);
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

// Helper to wait for element with text
export async function waitForText(page: Page, text: string | RegExp, options?: { timeout?: number }) {
  await page.waitForSelector(`text=${text}`, { timeout: options?.timeout || 10000 });
}

// Helper to fill trip creation form via natural language
export async function createTripViaAI(page: Page, tripDescription: string) {
  await page.goto('/dashboard/trips/new-message');
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.fill(tripDescription);
  await page.getByRole('button', { name: /create trip|submit/i }).click();
  await page.waitForSelector('[data-testid="trip-success"], .text-green-600, :has-text("Trip created")', {
    timeout: 60000
  });
}

// Helper to check if user is authenticated
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const dashboardLink = page.locator('a[href="/dashboard"], :has-text("Dashboard")');
    return await dashboardLink.isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

// Helper to logout
export async function logout(page: Page) {
  const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await waitForNavigation(page, '/', { timeout: 5000 });
  }
}

// Helper to wait for AI response
export async function waitForAIResponse(page: Page, timeout = 60000) {
  const loadingIndicator = page.locator('[data-testid="loading"], .animate-spin, :has-text("Processing")');
  try {
    await loadingIndicator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await loadingIndicator.waitFor({ state: 'hidden', timeout });
  } catch {
    // Loading may have finished quickly
  }
}
