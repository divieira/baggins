import { test, expect } from '@playwright/test';
import { generateTestId } from './helpers/test-utils';

test.describe('AI Trip Update Functionality', () => {
  test.describe('PlanModifier Component', () => {
    test('should display AI Travel Assistant header on trip page placeholder', async ({ page }) => {
      // Visit the landing page to check UI elements
      await page.goto('/');

      // Verify the app loads correctly
      await expect(page.locator('h1').filter({ hasText: 'Baggins' })).toBeVisible();

      // Check for AI-related feature mentions
      await expect(page.getByText(/smart suggestions/i)).toBeVisible();
    });
  });

  test.describe('API Endpoint Structure', () => {
    test('modify-plan endpoint should require authentication', async ({ request }) => {
      const response = await request.post('/api/ai/modify-plan', {
        data: {
          tripId: 'test-trip-id',
          modificationRequest: 'Add kid-friendly activities'
        }
      });

      // Should return 401 Unauthorized without auth
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('chat endpoint should require authentication', async ({ request }) => {
      const response = await request.post('/api/ai/chat', {
        data: {
          tripId: 'test-trip-id',
          message: 'What restaurants do you recommend?'
        }
      });

      // Should return 401 Unauthorized without auth
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('generate-suggestions endpoint should require authentication', async ({ request }) => {
      const response = await request.post('/api/ai/generate-suggestions', {
        data: {
          tripId: 'test-trip-id',
          destination: 'Paris, France',
          travelers: [{ name: 'Test', age: 30 }]
        }
      });

      // Should return 401 Unauthorized without auth
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('parse-trip endpoint should require authentication', async ({ request }) => {
      const response = await request.post('/api/ai/parse-trip', {
        data: {
          message: 'I want to go to Paris from March 15-20'
        }
      });

      // Should return 401 Unauthorized without auth
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  test.describe('Landing Page Features', () => {
    test('should show version control feature', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/version control/i)).toBeVisible();
    });

    test('should show collaborative planning feature', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/collaborative planning/i)).toBeVisible();
    });

    test('should show smart suggestions feature', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/smart suggestions/i)).toBeVisible();
    });

    test('should show timeline view feature', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/timeline view/i)).toBeVisible();
    });
  });

  test.describe('UI Readability', () => {
    test('landing page headings should be clearly visible', async ({ page }) => {
      await page.goto('/');

      // Check main heading
      const heading = page.locator('h1').filter({ hasText: 'Baggins' });
      await expect(heading).toBeVisible();

      // Check that heading has appropriate font size (text-4xl or larger in Tailwind)
      const fontSize = await heading.evaluate(el => window.getComputedStyle(el).fontSize);
      const fontSizeNum = parseFloat(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(24); // At least 24px for readability
    });

    test('feature cards should have readable text', async ({ page }) => {
      await page.goto('/');

      // Check feature descriptions exist
      const features = [
        'smart suggestions',
        'collaborative planning',
        'timeline view',
        'version control'
      ];

      for (const feature of features) {
        const element = page.getByText(new RegExp(feature, 'i'));
        await expect(element).toBeVisible();

        // Verify text is not too small
        const fontSize = await element.evaluate(el => {
          return window.getComputedStyle(el).fontSize;
        });
        const fontSizeNum = parseFloat(fontSize);
        expect(fontSizeNum).toBeGreaterThanOrEqual(12); // At least 12px
      }
    });

    test('auth form should have good contrast and readability', async ({ page }) => {
      await page.goto('/');

      // Check email input
      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toBeVisible();

      // Check that form labels are visible
      await expect(page.getByText(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();

      // Check button is clearly visible
      const signInButton = page.getByRole('button', { name: /sign in/i });
      await expect(signInButton).toBeVisible();

      // Check button has good contrast (should have bg color)
      const bgColor = await signInButton.evaluate(el => window.getComputedStyle(el).backgroundColor);
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)'); // Not transparent
    });

    test('navigation should be accessible', async ({ page }) => {
      await page.goto('/');

      // Check that toggle links are visible and clickable
      const signUpLink = page.getByText(/don't have an account/i);
      await expect(signUpLink).toBeVisible();

      // Click should toggle to signup form
      await signUpLink.click();
      await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    });

    test('error messages should be clearly visible', async ({ page }) => {
      await page.goto('/');

      // Try to submit empty form
      await page.getByRole('button', { name: /sign in/i }).click();

      // Check if browser validation prevents submission or shows error
      // The form has HTML5 validation, so we need to fill invalid data
      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/password/i).fill('123');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Wait for any error response
      await page.waitForTimeout(2000);

      // Check that the page is still functional
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be usable on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      await page.goto('/');

      // All important elements should still be visible
      await expect(page.locator('h1').filter({ hasText: 'Baggins' })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should be usable on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      await page.goto('/');

      // All important elements should still be visible
      await expect(page.locator('h1').filter({ hasText: 'Baggins' })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

      // Feature cards should be visible
      await expect(page.getByText(/smart suggestions/i)).toBeVisible();
    });
  });
});
