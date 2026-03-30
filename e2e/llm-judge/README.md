# LLM-as-Judge E2E Testing

End-to-end tests that simulate real user behavior and use Claude as a **judge** to evaluate whether AI-generated trip data (attractions, restaurants, itineraries, modifications) is sensible and appropriate.

## Architecture

```
e2e/
  llm-judge/
    app-config.ts         # ALL app-specific selectors, URLs, DB schema, timeouts
    page-helpers.ts       # Page Object Model — Playwright interactions via app-config
    db-helpers.ts         # Database queries via app-config schema constants
    types.ts              # Evaluation types, criteria thresholds (app-agnostic)
    judge.ts              # TripJudge class — calls Claude to evaluate (app-agnostic)
    scenarios.ts          # Pre-defined test scenarios (Paris, Tokyo, Rome, Bangkok)
  llm-trip-creation.spec.ts     # Trip creation + LLM evaluation
  llm-trip-modification.spec.ts # Plan modification + LLM evaluation
  llm-user-simulation.spec.ts   # Full user lifecycle simulation
```

### Abstraction Layers

The test framework is split into **app-agnostic** and **app-specific** layers:

| Layer | Files | What changes when... |
|---|---|---|
| **App config** (change this) | `app-config.ts` | ...UI selectors, routes, DB schema, or text labels change |
| **Page helpers** (change if flow differs) | `page-helpers.ts` | ...the interaction flow changes (e.g., login becomes SSO) |
| **DB helpers** (change if ORM differs) | `db-helpers.ts` | ...the database client or table structure changes |
| **Judge** (app-agnostic) | `judge.ts`, `types.ts` | ...never (evaluates generic trip data) |
| **Test specs** (app-agnostic) | `*.spec.ts` | ...never (pure test logic) |

To adapt to a different travel planning app, modify `app-config.ts` (and possibly `page-helpers.ts` / `db-helpers.ts`) — the spec files and judge module stay untouched.

### How It Works

1. **Playwright** drives the browser, simulating user interactions (typing trip descriptions, clicking attractions, requesting modifications)
2. **Supabase** is queried directly to extract generated data (attractions, restaurants, time blocks)
3. **Claude (LLM Judge)** evaluates the data quality using structured criteria:
   - **Attraction quality**: authenticity, location accuracy, hours, kid-friendliness, variety
   - **Restaurant quality**: authenticity, cuisine relevance, price accuracy, variety
   - **Itinerary logic**: schedule, geographic grouping, meal timing, pacing
   - **Modification quality**: request fulfillment, minimal changes, coherence
   - **Visual quality**: screenshot evaluation via Claude's vision capability

Each criterion is scored 0-10. Tests pass if the overall score meets the threshold (default: 6.0).

## Prerequisites

### Required

| Requirement | Purpose |
|---|---|
| Node.js 18+ | Runtime |
| `npm install` | Install dependencies (Playwright, Anthropic SDK, etc.) |
| `ANTHROPIC_API_KEY` | Powers both the app's AI and the LLM judge |
| Supabase instance | Database for trip data |
| `.env.test` file | Environment configuration |

### .env.test Configuration

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For test user creation
ANTHROPIC_API_KEY=your-anthropic-api-key
E2E_TEST_EMAIL=e2e-test@baggins.test
E2E_TEST_PASSWORD=TestPassword123!
```

## Running the Tests

### Install Dependencies

```bash
npm install
npx playwright install chromium
```

### Run All LLM-Judged E2E Tests

```bash
npx playwright test e2e/llm-trip-creation.spec.ts e2e/llm-trip-modification.spec.ts e2e/llm-user-simulation.spec.ts
```

### Run Individual Test Suites

```bash
# Trip creation evaluation
npx playwright test e2e/llm-trip-creation.spec.ts

# Plan modification evaluation
npx playwright test e2e/llm-trip-modification.spec.ts

# Full user simulation
npx playwright test e2e/llm-user-simulation.spec.ts
```

### Run Specific Tests

```bash
# Only the Family Paris attraction test
npx playwright test e2e/llm-trip-creation.spec.ts -g "Family Paris"

# Only structural tests (no LLM judge needed, faster)
npx playwright test e2e/llm-trip-creation.spec.ts -g "Structural"

# Only user simulation lifecycle test
npx playwright test e2e/llm-user-simulation.spec.ts -g "Family trip"
```

### Debug Mode

```bash
npx playwright test e2e/llm-trip-creation.spec.ts --debug
```

### View HTML Report

```bash
npx playwright show-report
```

## Test Categories

### Trip Creation Tests (`llm-trip-creation.spec.ts`)

| Test | What it evaluates |
|---|---|
| Family Paris: attractions | Kid-friendly accuracy, Paris landmarks, coordinate accuracy |
| Family Paris: restaurants | French cuisine presence, family-friendly options |
| Solo Tokyo: suggestions | Tech/anime relevance, Tokyo coordinates, Japanese food |
| Rome: itinerary | Schedule logic, geographic grouping, meal timing |
| Bangkok: budget | Restaurant price levels for budget trip |
| Comprehensive: full trip | All criteria + visual screenshot evaluation |
| Structural: data fields | Required fields, coordinate bounds (no LLM needed) |
| Structural: time blocks | Block types, no duplicates, proper assignments |

### Trip Modification Tests (`llm-trip-modification.spec.ts`)

| Test | What it evaluates |
|---|---|
| Kid-friendly modification | Were kid-friendly activities actually added? |
| Budget modification | Were expensive restaurants replaced with cheaper ones? |
| Outdoor modification | Were indoor activities swapped for outdoor ones? |
| Structural: new version | Does modification create a new plan version? |
| Structural: preservation | Are unmodified blocks preserved? |

### User Simulation Tests (`llm-user-simulation.spec.ts`)

| Test | What it simulates |
|---|---|
| Family trip lifecycle | Login → create → browse → select → modify → evaluate |
| Solo trip lifecycle | Create → evaluate variety → check coordinates/cuisines |
| Visual evaluation | Screenshots at multiple pages, mobile responsive check |
| Indecisive user | Select → clear → re-select different attraction |
| Trip isolation | Create two trips, verify no data leakage between them |

## Cost Considerations

Each LLM judge evaluation makes 1-3 Claude API calls. A full test run costs approximately:

| Test suite | Approximate API calls | Estimated cost |
|---|---|---|
| Trip creation (all) | ~12 judge calls + ~5 app calls per trip | ~$0.50-1.00 |
| Trip modification | ~6 judge calls + ~3 app calls per trip | ~$0.30-0.60 |
| User simulation | ~8 judge calls + ~3 app calls per trip | ~$0.40-0.80 |
| **Full suite** | **~26 judge calls** | **~$1.20-2.40** |

Tips for reducing cost:
- Run structural tests first (no LLM judge): `npx playwright test -g "Structural"`
- Run individual scenarios instead of full suite
- The judge uses `claude-sonnet-4-5` by default (cheaper than Opus)

## Can Claude Code Serve as the LLM Judge Directly?

**Short answer: No, not directly.** Claude Code runs interactively and doesn't expose a programmatic API that test code can call. The tests need to make structured API calls to Claude and parse JSON responses, which requires the Anthropic SDK + API key.

**However**, there are two practical alternatives:

1. **Same API key**: The tests use the same `ANTHROPIC_API_KEY` that powers the app. If you're running the app locally, you already have the key configured.

2. **Manual evaluation mode**: If you want Claude Code to act as the judge, you can:
   - Run the structural tests (which don't need the judge)
   - Copy the test output (attraction/restaurant data)
   - Paste it to Claude Code and ask: *"Evaluate these Paris attractions for a family trip with kids ages 5 and 8. Are they real? Are the coordinates correct? Are the hours sensible?"*
   - This gives you the same evaluation, just manually

## Extending the Tests

### Adding a New Scenario

Edit `e2e/llm-judge/scenarios.ts`:

```typescript
export const SCENARIOS = {
  // ... existing scenarios ...
  myNewScenario: {
    name: 'My New Scenario',
    description: 'Description of the trip',
    tripMessage: 'Natural language trip description...',
    context: {
      destination: 'City, Country',
      start_date: '2026-XX-XX',
      end_date: '2026-XX-XX',
      travelers: [{ name: 'Person', age: 30 }],
    },
    expectedTraits: ['What the judge should verify'],
    modificationRequests: ['Follow-up modifications to test'],
  },
};
```

### Adding a New Evaluation Criterion

Edit `e2e/llm-judge/judge.ts` and add a new method to the `TripJudge` class, following the pattern of existing evaluation methods. Each method:
1. Builds a structured prompt
2. Calls Claude with `this.callClaude(prompt)`
3. Parses the JSON response

### Adapting to a Different App

To use this test framework with a different travel planning application:

1. **Edit `app-config.ts`** — update selectors, routes, DB schema:
   ```typescript
   // Example: your app uses data-testid attributes
   export const SELECTORS = {
     timeBlockContainer: '[data-testid="time-block"]',
     suggestionCard: '[data-testid="suggestion-card"]',
     // ...
   };

   // Example: your app uses different routes
   export const ROUTES = {
     tripCreate: '/trips/new',
     tripDetail: /\/trips\/(\d+)$/,
     // ...
   };

   // Example: your DB uses different column names
   export const DB = {
     tables: { attractions: 'places', restaurants: 'dining_options' },
     columns: { cuisineType: 'food_type', priceLevel: 'cost_tier' },
   };
   ```

2. **Edit `page-helpers.ts`** if the interaction flow is different (e.g., multi-step login, different form layout).

3. **Edit `db-helpers.ts`** if you use a different database client (e.g., Prisma instead of Supabase).

4. **Judge module and spec files need no changes** — they work with generic trip data types.

### Adjusting the Pass Threshold

```typescript
// In your test file or globally
const judge = new TripJudge({ passThreshold: 7.0 }); // Stricter

// Or via the PASS_THRESHOLD constant in types.ts
```
