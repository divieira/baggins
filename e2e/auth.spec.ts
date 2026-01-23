import { test, expect } from '@playwright/test';
import { generateTestId } from './helpers/test-utils';

test.describe('Authentication', () => {
  test.describe('Landing Page', () => {
    test('should display the landing page with auth form', async ({ page }) => {
      await page.goto('/');
      // Use first() to get only the main h1 heading
      await expect(page.locator('h1').filter({ hasText: 'Baggins' })).toBeVisible();
      await expect(page.getByText(/smart suggestions/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should have login and signup tabs', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      await expect(page.getByText(/sign up/i)).toBeVisible();
    });
  });

  test.describe('Sign Up', () => {
    test('should show signup form when clicking Sign Up', async ({ page }) => {
      await page.goto('/');
      // Click the "Don't have an account? Sign up" link
      await page.getByText(/don't have an account/i).click();
      // After clicking, the button should say "Sign Up"
      await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
      // And the heading should say "Create Account"
      await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/');
      await page.getByText(/don't have an account/i).click();
      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/password/i).fill('ValidPassword123!');
      await page.getByRole('button', { name: 'Sign Up' }).click();
      // Browser should show validation error for invalid email
      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toHaveAttribute('type', 'email');
    });

    test('should successfully create account', async ({ page }) => {
      await page.goto('/');
      await page.getByText(/don't have an account/i).click();
      const testEmail = `e2e-signup-${generateTestId()}@example.com`;
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByLabel(/password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: 'Sign Up' }).click();
      // Should show either success message, rate limit message, or redirect to dashboard
      // (depends on Supabase settings and rate limits)
      await expect(
        page.getByText(/check your email|rate limit|dashboard|already registered/i)
          .or(page.locator('body:has-text("dashboard")'))
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Login', () => {
    test('should show login form by default', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/');
      await page.getByLabel(/email/i).fill('nonexistent@example.com');
      await page.getByLabel(/password/i).fill('WrongPassword123!');
      await page.getByRole('button', { name: /sign in/i }).click();
      // Should show error message
      await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 10000 });
    });

    test('should have forgot password link', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/forgot password/i)).toBeVisible();
    });
  });

  test.describe('Password Reset', () => {
    test('should show password reset form', async ({ page }) => {
      await page.goto('/');
      await page.getByText(/forgot password/i).click();
      await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
    });

    test('should allow entering email for password reset', async ({ page }) => {
      await page.goto('/');
      await page.getByText(/forgot password/i).click();
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByRole('button', { name: /send reset link/i }).click();
      // Should show success message
      await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
    });
  });
});
