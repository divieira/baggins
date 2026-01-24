import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@baggins.test';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';

test.describe('Time Block Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should allow only one selection per time block', async ({ page }) => {
    // Navigate to a trip with time blocks
    await page.goto('/dashboard');

    const tripLinks = page.locator('a[href*="/dashboard/trips/"]').filter({
      hasNotText: /new|message/i
    });

    const tripLinkCount = await tripLinks.count();

    if (tripLinkCount === 0) {
      console.log('No existing trips found - skipping test');
      test.skip();
      return;
    }

    // Click on the first trip
    await tripLinks.first().click();
    await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/);

    // Switch to timeline view
    const timelineButton = page.getByRole('button', { name: /view itinerary/i });
    if (await timelineButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await timelineButton.click();
      await page.waitForTimeout(1000);

      // Find time blocks with suggestions
      const timeBlocks = page.locator('.border.border-stone-200.rounded-2xl');
      const blockCount = await timeBlocks.count();

      if (blockCount > 0) {
        // Click on the first time block to interact with it
        const firstBlock = timeBlocks.first();

        // Look for suggestion cards within this block
        const suggestionCards = firstBlock.locator('.flex-shrink-0.snap-center.bg-white.rounded-2xl');
        const cardCount = await suggestionCards.count();

        if (cardCount >= 2) {
          // Get the first card's name (might be selected or first suggestion)
          const firstCardName = await suggestionCards.first().locator('h4').textContent();

          // Check if first card is already selected
          const isFirstSelected = await suggestionCards.first().locator('text="Selected ✓"').isVisible().catch(() => false);

          if (isFirstSelected && cardCount >= 3) {
            // First card is already selected, click on the second one (first unselected)
            const selectButton = suggestionCards.nth(1).getByRole('button', { name: /select/i });

            if (await selectButton.isVisible({ timeout: 1000 }).catch(() => false)) {
              const secondCardName = await suggestionCards.nth(1).locator('h4').textContent();
              await selectButton.click();

              // Wait for the selection to update
              await page.waitForTimeout(2000);

              // Verify that only ONE card shows "Selected ✓"
              const selectedCount = await firstBlock.locator('text="Selected ✓"').count();
              expect(selectedCount).toBe(1);

              // Verify the second card is now selected (it should be first in the list)
              const newFirstCard = suggestionCards.first();
              const newFirstCardName = await newFirstCard.locator('h4').textContent();
              expect(newFirstCardName).toBe(secondCardName);
              await expect(newFirstCard.locator('text="Selected ✓"')).toBeVisible();
            }
          } else if (!isFirstSelected && cardCount >= 1) {
            // No selection yet, select the first card
            const selectButton = suggestionCards.first().getByRole('button', { name: /select/i });

            if (await selectButton.isVisible({ timeout: 1000 }).catch(() => false)) {
              await selectButton.click();
              await page.waitForTimeout(2000);

              // Verify exactly ONE card shows "Selected ✓"
              const selectedCount = await firstBlock.locator('text="Selected ✓"').count();
              expect(selectedCount).toBe(1);

              // Now select a different card
              if (cardCount >= 2) {
                const secondSelectButton = suggestionCards.nth(1).getByRole('button', { name: /select/i });
                if (await secondSelectButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                  await secondSelectButton.click();
                  await page.waitForTimeout(2000);

                  // Verify still only ONE card shows "Selected ✓"
                  const newSelectedCount = await firstBlock.locator('text="Selected ✓"').count();
                  expect(newSelectedCount).toBe(1);
                }
              }
            }
          }
        } else {
          console.log('Not enough suggestion cards to test selection - skipping');
          test.skip();
        }
      } else {
        console.log('No time blocks found - skipping test');
        test.skip();
      }
    } else {
      console.log('Timeline view not available - skipping test');
      test.skip();
    }
  });

  test('should not show duplicate entries in time block', async ({ page }) => {
    // Navigate to a trip with time blocks
    await page.goto('/dashboard');

    const tripLinks = page.locator('a[href*="/dashboard/trips/"]').filter({
      hasNotText: /new|message/i
    });

    const tripLinkCount = await tripLinks.count();

    if (tripLinkCount === 0) {
      console.log('No existing trips found - skipping test');
      test.skip();
      return;
    }

    // Click on the first trip
    await tripLinks.first().click();
    await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/);

    // Switch to timeline view
    const timelineButton = page.getByRole('button', { name: /view itinerary/i });
    if (await timelineButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await timelineButton.click();
      await page.waitForTimeout(1000);

      // Find time blocks with suggestions
      const timeBlocks = page.locator('.border.border-stone-200.rounded-2xl');
      const blockCount = await timeBlocks.count();

      if (blockCount > 0) {
        const firstBlock = timeBlocks.first();

        // Get all suggestion card names
        const suggestionCards = firstBlock.locator('.flex-shrink-0.snap-center.bg-white.rounded-2xl');
        const cardCount = await suggestionCards.count();

        if (cardCount > 1) {
          const cardNames = [];
          for (let i = 0; i < cardCount; i++) {
            const name = await suggestionCards.nth(i).locator('h4').textContent();
            cardNames.push(name?.replace(/^★\s*/, '').trim()); // Remove star if present
          }

          // Check for duplicates
          const uniqueNames = new Set(cardNames);
          expect(uniqueNames.size).toBe(cardNames.length);

          console.log(`Found ${cardNames.length} cards with ${uniqueNames.size} unique names`);
        } else {
          console.log('Not enough cards to check for duplicates - skipping');
          test.skip();
        }
      } else {
        console.log('No time blocks found - skipping test');
        test.skip();
      }
    } else {
      console.log('Timeline view not available - skipping test');
      test.skip();
    }
  });

  test('should clear selection when Clear button is clicked', async ({ page }) => {
    // Navigate to a trip with time blocks
    await page.goto('/dashboard');

    const tripLinks = page.locator('a[href*="/dashboard/trips/"]').filter({
      hasNotText: /new|message/i
    });

    const tripLinkCount = await tripLinks.count();

    if (tripLinkCount === 0) {
      console.log('No existing trips found - skipping test');
      test.skip();
      return;
    }

    // Click on the first trip
    await tripLinks.first().click();
    await page.waitForURL(/\/dashboard\/trips\/[a-f0-9-]+$/);

    // Switch to timeline view
    const timelineButton = page.getByRole('button', { name: /view itinerary/i });
    if (await timelineButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await timelineButton.click();
      await page.waitForTimeout(1000);

      // Find time blocks with selections
      const timeBlocks = page.locator('.border.border-stone-200.rounded-2xl');
      const blockCount = await timeBlocks.count();

      if (blockCount > 0) {
        for (let i = 0; i < blockCount; i++) {
          const block = timeBlocks.nth(i);
          const selectedBadge = block.locator('text="Selected ✓"');

          if (await selectedBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
            // This block has a selection, try to clear it
            const clearButton = block.getByRole('button', { name: /clear/i });

            if (await clearButton.isVisible({ timeout: 1000 }).catch(() => false)) {
              await clearButton.click();
              await page.waitForTimeout(2000);

              // Verify the selection is cleared
              await expect(selectedBadge).not.toBeVisible();

              // Verify no "Selected ✓" badges remain in this block
              const selectedCount = await block.locator('text="Selected ✓"').count();
              expect(selectedCount).toBe(0);

              break; // Only test one block
            }
          }
        }
      } else {
        console.log('No time blocks found - skipping test');
        test.skip();
      }
    } else {
      console.log('Timeline view not available - skipping test');
      test.skip();
    }
  });
});
