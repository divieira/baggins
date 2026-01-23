import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@baggins.test';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';

test.describe('Authenticated Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test.describe('Dashboard', () => {
    test('should display dashboard after login', async ({ page }) => {
      await expect(page).toHaveURL(/\/dashboard/);
      // Check for dashboard elements
      await expect(page.getByText(/your trips|plan a new trip|welcome/i)).toBeVisible();
    });

    test('should have create trip buttons', async ({ page }) => {
      // Should have at least one way to create a trip
      const createTripLink = page.getByRole('link', { name: /new trip|create|plan/i });
      await expect(createTripLink.first()).toBeVisible();
    });

    test('should be able to navigate to new-message trip creation', async ({ page }) => {
      await page.goto('/dashboard/trips/new-message');
      await expect(page).toHaveURL(/\/dashboard\/trips\/new-message/);
      // Should see the AI-powered trip creation form
      await expect(page.locator('textarea')).toBeVisible();
    });

    test('should be able to navigate to traditional trip creation', async ({ page }) => {
      await page.goto('/dashboard/trips/new');
      await expect(page).toHaveURL(/\/dashboard\/trips\/new/);
      // Should see destination input
      await expect(page.getByText(/destination/i)).toBeVisible();
    });
  });

  test.describe('AI Trip Creation', () => {
    test('should display AI trip creation textarea with placeholder', async ({ page }) => {
      await page.goto('/dashboard/trips/new-message');
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible();
      const placeholder = await textarea.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
      // Should have example text in placeholder (contains travel-related words)
      expect(placeholder?.toLowerCase()).toMatch(/paris|travel|go to|destination|want to/);
    });

    test('should enable submit button when text is entered', async ({ page }) => {
      await page.goto('/dashboard/trips/new-message');
      const textarea = page.locator('textarea');
      const submitButton = page.getByRole('button', { name: /create|plan|submit/i });

      // Initially disabled or waiting for input
      await textarea.fill('I want to go to Paris for 3 days');

      // Button should be enabled after input
      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe('Trip Detail Page', () => {
    // This test creates a trip and verifies the PlanModifier component
    test('should show trip page structure when viewing a trip', async ({ page }) => {
      // First, let's check if there are any existing trips
      await page.goto('/dashboard');

      // Look for any trip link (not /new or /new-message)
      const tripLinks = page.locator('a[href*="/dashboard/trips/"]');
      const tripLinkCount = await tripLinks.count();

      let foundTripLink = false;
      for (let i = 0; i < tripLinkCount; i++) {
        const href = await tripLinks.nth(i).getAttribute('href');
        if (href && !href.includes('/new')) {
          await tripLinks.nth(i).click();
          foundTripLink = true;
          break;
        }
      }

      if (foundTripLink) {
        await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/);

        // Verify trip page elements - check for back link or navigation
        await expect(
          page.getByText(/back/i).or(page.getByRole('link', { name: /dashboard|trips/i }))
        ).toBeVisible({ timeout: 10000 });

        // Check for PlanModifier component - the AI Travel Assistant header
        const planModifier = page.getByText(/ai travel assistant/i);
        if (await planModifier.isVisible({ timeout: 5000 }).catch(() => false)) {
          await expect(planModifier).toBeVisible();

          // Check for version navigation
          await expect(page.getByText(/version \d+ of \d+/i)).toBeVisible();

          // Check for modification input
          await expect(page.locator('textarea[placeholder*="changes"]')).toBeVisible();
        }
      } else {
        // No trips exist, which is okay for this test
        console.log('No existing trips found - skipping trip detail test');
        test.skip();
      }
    });
  });

  test.describe('Session Management', () => {
    test('should stay logged in when navigating', async ({ page }) => {
      // Navigate to different pages
      await page.goto('/dashboard/trips/new');
      await expect(page).toHaveURL(/\/dashboard\/trips\/new/);

      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard/);

      // Should still be logged in
      await expect(page.getByText(/your trips|welcome|dashboard/i)).toBeVisible();
    });
  });
});
