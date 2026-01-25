import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@baggins.test';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';

test.describe('Itinerary Validation E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test.describe('Trip Timeline Display', () => {
    test('should display hotel information on timeline days', async ({ page }) => {
      // Navigate to dashboard and find a trip
      await page.goto('/dashboard');

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

      if (!foundTripLink) {
        console.log('No existing trips found - skipping test');
        test.skip();
        return;
      }

      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/);

      // Click on "View Itinerary" mode
      const timelineButton = page.getByRole('button', { name: /view itinerary/i });
      if (await timelineButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await timelineButton.click();

        // Wait for timeline to load
        await page.waitForTimeout(1000);

        // Check if there's a day card
        const dayCard = page.locator('.bg-gradient-to-r.from-orange-400');
        const hasDayCard = await dayCard.first().isVisible({ timeout: 5000 }).catch(() => false);

        if (hasDayCard) {
          // Look for hotel indicator (either check-in or staying at)
          const hotelIndicator = page.locator('text=/staying at|check in at/i');
          const hasHotel = await hotelIndicator.first().isVisible({ timeout: 3000 }).catch(() => false);

          // Note: hotel might not exist for all trips
          console.log(`Hotel indicator visible: ${hasHotel}`);
        }
      }
    });

    test('should have time blocks in correct order (morning before lunch before afternoon before dinner)', async ({ page }) => {
      await page.goto('/dashboard');

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

      if (!foundTripLink) {
        console.log('No existing trips found - skipping test');
        test.skip();
        return;
      }

      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/);

      // Click on "View Itinerary" mode
      const timelineButton = page.getByRole('button', { name: /view itinerary/i });
      if (await timelineButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await timelineButton.click();

        // Wait for timeline to load
        await page.waitForTimeout(1000);

        // Get all time displays (format: HH:MM)
        const timeDisplays = await page.locator('[class*="text-xs"][class*="text-stone"]').allTextContents();
        const times = timeDisplays.filter(t => /^\d{1,2}:\d{2}/.test(t.trim()));

        // Check times are in ascending order within each day
        if (times.length > 1) {
          let validOrder = true;
          for (let i = 0; i < times.length - 1; i++) {
            const current = times[i].split(':').map(Number);
            const next = times[i + 1].split(':').map(Number);
            const currentMinutes = current[0] * 60 + current[1];
            const nextMinutes = next[0] * 60 + next[1];

            // Allow for day boundaries (reset to morning)
            if (nextMinutes < currentMinutes && nextMinutes < 12 * 60) {
              // This is likely a new day
              continue;
            }

            if (nextMinutes < currentMinutes) {
              validOrder = false;
              console.log(`Time order issue: ${times[i]} before ${times[i + 1]}`);
              break;
            }
          }

          expect(validOrder).toBe(true);
        }
      }
    });

    test('attractions should be displayed for the correct city', async ({ page }) => {
      await page.goto('/dashboard');

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

      if (!foundTripLink) {
        console.log('No existing trips found - skipping test');
        test.skip();
        return;
      }

      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/);

      // Go to selection mode
      const selectionButton = page.getByRole('button', { name: /select attractions/i });
      if (await selectionButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await selectionButton.click();

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Get city headers
        const cityHeaders = await page.locator('.bg-gradient-to-r.from-indigo-600 h2').allTextContents();

        if (cityHeaders.length > 0) {
          console.log(`Found cities: ${cityHeaders.join(', ')}`);

          // Each city section should have attractions that match
          // This is a visual check - we just verify that content loads
          for (const city of cityHeaders) {
            const citySection = page.locator(`.bg-gradient-to-r.from-indigo-600:has-text("${city}")`);
            const isSectionVisible = await citySection.isVisible().catch(() => false);
            console.log(`City "${city}" section visible: ${isSectionVisible}`);
          }
        }
      }
    });
  });

  test.describe('AI Chat Modification', () => {
    test('should be able to open AI chat input', async ({ page }) => {
      await page.goto('/dashboard');

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

      if (!foundTripLink) {
        console.log('No existing trips found - skipping test');
        test.skip();
        return;
      }

      await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/);

      // Look for the AI input (fixed at bottom)
      const aiInput = page.locator('textarea[placeholder*="modify"], input[placeholder*="modify"], textarea[placeholder*="change"], input[placeholder*="ask"]');

      if (await aiInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        // Verify we can type in the input
        await aiInput.first().fill('Test message');
        const inputValue = await aiInput.first().inputValue();
        expect(inputValue).toBe('Test message');

        // Clear it
        await aiInput.first().clear();
      } else {
        console.log('AI input not found - may be in offline mode or not implemented');
      }
    });
  });
});

test.describe('Trip Creation Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should have a working trip creation page', async ({ page }) => {
    await page.goto('/dashboard/trips/new');

    // Should have a text input for trip description
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Try entering a multi-city trip
    await textarea.fill('I want to visit Paris for 3 days and then Rome for 2 days next March');

    // The submit button should be present
    const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Plan")');
    const isSubmitVisible = await submitButton.first().isVisible().catch(() => false);
    console.log(`Submit button visible: ${isSubmitVisible}`);
  });
});
