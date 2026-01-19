/**
 * Get the application URL
 * Uses VERCEL_URL in production, falls back to NEXT_PUBLIC_APP_URL or localhost
 */
export function getAppUrl(): string {
  // Check if we're in the browser
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // Server-side: Check for Vercel URL first
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // Fall back to explicitly set URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  // Default to localhost for development
  return 'http://localhost:3000'
}
