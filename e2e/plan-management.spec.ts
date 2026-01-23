import { test, expect } from '@playwright/test';

test.describe('Plan Management', () => {
  test.describe('Page Structure', () => {
    test('should have dashboard page that requires auth', async ({ page }) => {
      await page.goto('/dashboard');
      // Should redirect to home page for unauthenticated users
      await expect(page).toHaveURL('/');
      // Home page should have login form
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    test('should have trips new-message page', async ({ page }) => {
      await page.goto('/dashboard/trips/new-message');
      // Will redirect if not authenticated, that's expected
      const url = page.url();
      expect(url === '/' || url.includes('new-message')).toBeTruthy();
    });

    test('should have trips new page', async ({ page }) => {
      await page.goto('/dashboard/trips/new');
      // Will redirect if not authenticated, that's expected
      const url = page.url();
      expect(url === '/' || url.includes('new')).toBeTruthy();
    });
  });

  test.describe('UI Elements', () => {
    test('landing page should display all feature cards', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/smart suggestions/i)).toBeVisible();
      await expect(page.getByText(/collaborative planning/i)).toBeVisible();
      await expect(page.getByText(/timeline view/i)).toBeVisible();
      await expect(page.getByText(/version control/i)).toBeVisible();
    });

    test('landing page should have proper branding', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h1').filter({ hasText: 'Baggins' })).toBeVisible();
      await expect(page.getByText(/ai-assisted travel planning/i)).toBeVisible();
    });

    test('auth form should have all required elements', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      await expect(page.getByText(/forgot password/i)).toBeVisible();
      await expect(page.getByText(/don't have an account/i)).toBeVisible();
    });
  });

  test.describe('Form Interactions', () => {
    test('should toggle between login and signup forms', async ({ page }) => {
      await page.goto('/');
      // Start with login form
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

      // Switch to signup
      await page.getByText(/don't have an account/i).click();
      await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();

      // Switch back to login
      await page.getByText(/already have an account/i).click();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should toggle to password reset form', async ({ page }) => {
      await page.goto('/');
      await page.getByText(/forgot password/i).click();
      await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
      // Password field should be hidden
      await expect(page.getByLabel(/password/i)).not.toBeVisible();
    });
  });
});
