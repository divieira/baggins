/**
 * Application Configuration for E2E Tests
 *
 * ALL app-specific selectors, URLs, database schema, text patterns, and
 * structural assumptions are centralized here. To adapt these tests to a
 * different travel planning app (or after UI/schema changes), modify ONLY
 * this file — the test logic and LLM judge remain unchanged.
 */

// ─── URL Routes ─────────────────────────────────────────────────────────────

export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  tripCreate: '/dashboard/trips/new-message',
  /** Regex matching the trip detail page URL. Group 1 captures the trip ID. */
  tripDetail: /\/dashboard\/trips\/([a-f0-9-]+)$/,
  /** Regex to test we landed on the dashboard. */
  dashboardPattern: /\/dashboard/,
};

// ─── UI Selectors ───────────────────────────────────────────────────────────
// Prefer data-testid where available; fall back to semantic selectors.

export const SELECTORS = {
  // Auth form
  emailInput: { role: 'textbox', name: /email/i } as const,
  passwordInput: { label: /password/i } as const,
  signInButton: { role: 'button', name: /sign in/i } as const,

  // Trip creation
  tripMessageInput: 'textarea',
  tripSubmitButton: { role: 'button', name: /create trip|plan my trip/i } as const,

  // Itinerary / timeline
  viewItineraryButton: { role: 'button', name: /view itinerary|timeline/i } as const,

  // Time blocks and suggestion cards
  // These are the most fragile selectors — replace with data-testid if available.
  timeBlockContainer: '.border.border-stone-200.rounded-2xl',
  suggestionCard: '.flex-shrink-0.snap-center.bg-white.rounded-2xl',
  cardTitle: 'h4',
  selectButton: { role: 'button', name: /select/i } as const,
  clearButton: { role: 'button', name: /clear/i } as const,
  selectedBadge: 'text="Selected ✓"',

  // Plan modification
  modificationInputCandidates: [
    'input[placeholder*="odif"]',
    'textarea[placeholder*="odif"]',
    'input[placeholder*="hange"]',
    'textarea[placeholder*="hange"]',
    '[data-testid="plan-modifier-input"]',
    '.plan-modifier input',
    '.plan-modifier textarea',
  ],
  modificationInputFallback: 'input[type="text"]',
  modificationSubmitButton: { role: 'button', name: /modify|update|apply|submit|send/i } as const,

  // Trip list on dashboard
  tripLink: 'a[href*="/dashboard/trips/"]',
  tripLinkExcludePattern: /new|message/i,
};

// ─── Database Schema ────────────────────────────────────────────────────────
// Table names and column mappings. Change these if your schema differs.

export const DB = {
  tables: {
    trips: 'trips',
    cities: 'trip_cities',
    travelers: 'travelers',
    attractions: 'attractions',
    restaurants: 'restaurants',
    timeBlocks: 'time_blocks',
    planVersions: 'plan_versions',
  },
  columns: {
    // Common
    id: 'id',
    tripId: 'trip_id',
    cityId: 'city_id',

    // Trips
    destination: 'destination',
    startDate: 'start_date',
    endDate: 'end_date',

    // Cities
    orderIndex: 'order_index',

    // Attractions
    name: 'name',
    description: 'description',
    category: 'category',
    latitude: 'latitude',
    longitude: 'longitude',
    openingTime: 'opening_time',
    closingTime: 'closing_time',
    durationMinutes: 'duration_minutes',
    isKidFriendly: 'is_kid_friendly',
    minAge: 'min_age',
    highlights: 'highlights',

    // Restaurants (additional to shared)
    cuisineType: 'cuisine_type',
    priceLevel: 'price_level',

    // Time blocks
    date: 'date',
    blockType: 'block_type',
    startTime: 'start_time',
    endTime: 'end_time',
    selectedAttractionId: 'selected_attraction_id',
    selectedRestaurantId: 'selected_restaurant_id',
    planVersionId: 'plan_version_id',

    // Plan versions
    versionNumber: 'version_number',
  },
};

// ─── Time Block Types ───────────────────────────────────────────────────────

export const BLOCK_TYPES = {
  all: ['morning', 'lunch', 'afternoon', 'dinner', 'evening'] as string[],
  /** Block types that should have attractions (not restaurants). */
  activityBlocks: ['morning', 'afternoon', 'evening'] as string[],
  /** Block types that should have restaurants (not attractions). */
  mealBlocks: ['lunch', 'dinner'] as string[],
};

// ─── Timeouts ───────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  login: 15_000,
  tripCreation: 120_000,
  pageLoad: 10_000,
  aiResponse: 20_000,
  selectionUpdate: 2_000,
  elementVisibility: 5_000,
  shortWait: 1_500,

  // Test-level timeouts
  aiTest: 180_000,        // 3 min for creation tests
  modificationTest: 240_000, // 4 min for modification tests
  simulationTest: 300_000,   // 5 min for full simulation
};

// ─── Auth Credentials ───────────────────────────────────────────────────────

export const AUTH = {
  email: process.env.E2E_TEST_EMAIL || 'e2e-test@baggins.test',
  password: process.env.E2E_TEST_PASSWORD || 'TestPassword123!',
};

// ─── LLM Judge Config ───────────────────────────────────────────────────────

export const JUDGE = {
  model: 'claude-sonnet-4-5',
  passThreshold: 6.0,
};

// ─── Geographic Bounds ──────────────────────────────────────────────────────
// Used for structural coordinate validation (no LLM needed).

export const GEO_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  paris:   { minLat: 48.7, maxLat: 49.0, minLng: 2.1, maxLng: 2.6 },
  tokyo:   { minLat: 35.4, maxLat: 35.9, minLng: 139.4, maxLng: 140.0 },
  rome:    { minLat: 41.7, maxLat: 42.1, minLng: 12.2, maxLng: 12.8 },
  bangkok: { minLat: 13.5, maxLat: 14.0, minLng: 100.3, maxLng: 100.8 },
};
