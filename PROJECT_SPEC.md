# Baggins — Project Specification

A travel planning application where users describe trips in natural language and receive AI-generated daily itineraries with attractions, restaurants, and logistics.

This spec defines **what** the system must do and **how to verify it**, not how to build it. An implementer should be able to build a fully working version from this document alone.

---

## 1. Product Goals

1. **Natural-language trip creation** — A user types a free-form message ("Going to Paris and Lyon March 15-22 with my wife and 7-year-old son") and gets a fully structured trip with cities, dates, travelers, flights, and hotels extracted automatically.
2. **AI-generated suggestions** — For each city the system produces ~10 attractions and ~10 restaurants with real coordinates, hours, durations, kid-friendliness, and photos.
3. **AI-generated daily itinerary** — The system schedules suggestions into a day-by-day timeline of time blocks (morning activity, lunch, afternoon activity, dinner) respecting opening hours, traveler ages, and proximity.
4. **Interactive plan modification** — Users can chat with the AI to adjust the plan ("swap the museum for something outdoors", "add a beach day") and get a new versioned itinerary.
5. **Version control** — Every AI modification creates a new plan version; users can navigate between versions.
6. **Offline resilience** — The app caches trip data locally and degrades gracefully to read-only when offline.

---

## 2. User Roles & Authentication

### 2.1 Authentication
- Email/password authentication via Supabase Auth.
- Email confirmation flow for new signups.
- Password reset flow (email link → reset form → redirect to home).
- Session refresh via middleware on every request.

### 2.2 Authorization
- **Owner**: Full CRUD on their trips and all related data.
- **Editor**: Can modify trip plans (collaborator role — DB schema supports this, UI optional).
- **Viewer**: Read-only access (DB schema supports this, UI optional).
- All database tables enforce Row-Level Security (RLS). No data is accessible without a valid auth session and matching trip access.

### 2.3 Acceptance Criteria
| # | Criterion |
|---|-----------|
| A-1 | A new user can sign up with email/password and receive a confirmation email. |
| A-2 | A confirmed user can sign in and is redirected to the dashboard. |
| A-3 | An unauthenticated user cannot access `/dashboard` or any trip page. |
| A-4 | A user can request a password reset, receive an email, and set a new password. |
| A-5 | A user cannot read or write another user's trip data (enforced at DB level via RLS). |

---

## 3. Trip Creation (Natural Language Parsing)

### 3.1 Goal
Accept a single free-text message and produce a complete trip structure.

### 3.2 Input
A natural-language string such as:
> "We're going to Santiago Jan 10-14 then Pucon Jan 14-18. Family of 4 — me (38), wife Maria (36), kids Tomas (10) and Sofia (7). Flying LATAM LA401 from Lima 8am arriving Santiago 1pm."

### 3.3 Required Extraction
The AI must extract and create records for:

| Entity | Required Fields | Notes |
|--------|----------------|-------|
| **Cities** | name, start_date, end_date, order_index | Multiple cities supported. Assume current year if omitted. |
| **Travelers** | name, age, relationship | Infer ages from context ("my 7-year-old son"). |
| **Flights** | date, departure/arrival airport & time, airline, flight_number | Optional — only if mentioned. |
| **Hotels** | name, address, check_in/check_out dates, latitude, longitude, city assignment | Optional — only if mentioned. Coordinates must be realistic for the city. |

### 3.4 Post-Parsing Pipeline
After extraction the system must automatically:
1. Create all database records (trip, cities, travelers, flights, hotels, collaborator as owner).
2. Generate AI suggestions (attractions + restaurants) for **each city**.
3. Generate an AI itinerary (time blocks) for **each city** using the generated suggestions.

### 3.5 Acceptance Criteria
| # | Criterion |
|---|-----------|
| T-1 | A single-city trip message produces a trip with 1 city, correct dates, and travelers. |
| T-2 | A multi-city trip message (e.g., "Santiago then Pucon") produces multiple `trip_cities` with correct date ranges and order. |
| T-3 | Traveler ages are correctly extracted and stored. |
| T-4 | Flight details are extracted when present; omitted fields are handled gracefully. |
| T-5 | After parsing, each city has ~10 attractions and ~10 restaurants in the database. |
| T-6 | After parsing, time blocks exist for every day of every city. |
| T-7 | Attractions/restaurants are assigned to the correct `city_id` — never cross-city. |
| T-8 | If the message is too vague (no destination or dates), the API returns a clear error. |

---

## 4. AI Suggestion Generation

### 4.1 Goal
For a given city and traveler group, produce a pool of attractions and restaurants.

### 4.2 Output Schema — Attractions (×10 per city)

| Field | Type | Constraints |
|-------|------|-------------|
| name | string | Unique within the city |
| description | string | 1-3 sentences |
| category | string | e.g., "museum", "park", "landmark" |
| latitude | number | Valid coordinate for the city |
| longitude | number | Valid coordinate for the city |
| opening_time | string (HH:MM) or null | null = always open |
| closing_time | string (HH:MM) or null | |
| duration_minutes | integer | Typical visit length |
| is_kid_friendly | boolean | |
| min_age | integer or null | |
| highlights | string[] | 2-4 notable features |
| image_search_term | string | For photo lookup |

### 4.3 Output Schema — Restaurants (×10 per city)

| Field | Type | Constraints |
|-------|------|-------------|
| name | string | Unique within the city |
| description | string | 1-3 sentences |
| cuisine_type | string | e.g., "Italian", "Seafood" |
| latitude | number | Valid coordinate for the city |
| longitude | number | Valid coordinate for the city |
| opening_time | string (HH:MM) or null | |
| closing_time | string (HH:MM) or null | |
| price_level | integer | 1-4 ($ to $$$$) |
| is_kid_friendly | boolean | |
| highlights | string[] | 2-4 notable features |
| image_search_term | string | For photo lookup |

### 4.4 Photo Resolution
Each suggestion should have an `image_url` resolved via:
1. Google Places API photo (if `GOOGLE_MAPS_API_KEY` is configured).
2. Fallback: Unsplash search using the `image_search_term`.

### 4.5 Acceptance Criteria
| # | Criterion |
|---|-----------|
| S-1 | Each city gets approximately 10 attractions and 10 restaurants. |
| S-2 | All coordinates are geographically plausible for the named city. |
| S-3 | When travelers include young children, some suggestions are marked kid-friendly. |
| S-4 | Suggestions include a mix of categories (not all museums, not all parks). |
| S-5 | Opening/closing times are in HH:MM format or null. |
| S-6 | No duplicate names within a city's suggestion pool. |
| S-7 | Each suggestion is linked to the correct `city_id`. |

---

## 5. Itinerary Generation (Time Block Scheduling)

### 5.1 Goal
Given a city's date range and suggestion pool, produce a day-by-day schedule.

### 5.2 Time Block Structure
Each day is divided into up to 5 blocks:

| Block Type | Default Window | Content |
|------------|---------------|---------|
| morning | 09:00 – 12:00 | Attraction |
| lunch | 12:00 – 13:30 | Restaurant |
| afternoon | 13:30 – 17:00 | Attraction |
| dinner | 18:00 – 20:00 | Restaurant |
| evening | 20:00+ | Attraction (optional) |

### 5.3 Scheduling Rules
1. **No duplicate assignments** — An attraction or restaurant appears in at most one time block across the entire plan.
2. **Respect opening hours** — An attraction assigned to "morning" must be open during morning hours.
3. **Even distribution** — If there are N days and M attractions, spread them; at least 50% of days should have activities (when enough attractions exist).
4. **First day has activities** — Unless it's a travel-only day, the first day should not be empty.
5. **Arrival day adjustment** — If there's a late-arriving flight, skip morning/afternoon blocks.
6. **Kid-friendly preference** — When young children are in the group, prefer kid-friendly options.

### 5.4 Multi-City Behavior
- Each city's itinerary is generated independently.
- Generating/regenerating one city's itinerary must not destroy another city's time blocks.
- Time blocks are linked to their `city_id`.

### 5.5 Version Control
- Each itinerary generation creates a new `plan_version` with an incrementing `version_number`.
- `plan_data` stores a JSON snapshot of the plan state.
- Time blocks reference their `plan_version_id`.

### 5.6 Acceptance Criteria
| # | Criterion |
|---|-----------|
| I-1 | Every day within a city's date range has time blocks created. |
| I-2 | No attraction or restaurant is assigned to more than one time block. |
| I-3 | Assigned attractions are open during their block's time window. |
| I-4 | A plan version record is created with incrementing version number. |
| I-5 | Regenerating City A's itinerary preserves City B's existing time blocks. |
| I-6 | Activities are distributed across days, not clustered on day 1. |
| I-7 | The itinerary response includes a human-readable summary. |

---

## 6. Plan Modification (AI Chat)

### 6.1 Goal
Users can request changes to the current plan via natural language. The system modifies the relevant time blocks and produces a new version.

### 6.2 Modification Flow
1. User submits a modification request (e.g., "Replace indoor activities with outdoor ones").
2. System sends current plan state + request to AI.
3. AI returns only the **changed** time blocks (not the full plan).
4. System validates changes:
   - Attractions/restaurants must belong to the correct city.
   - Referenced IDs must exist in the database.
5. System creates a new plan version with changes applied.

### 6.3 Acceptance Criteria
| # | Criterion |
|---|-----------|
| M-1 | A modification request produces a new plan version with a higher version number. |
| M-2 | Only the affected time blocks are changed; others remain intact. |
| M-3 | The AI cannot assign an attraction from City A to a time block in City B. |
| M-4 | The response includes a summary of what was changed. |
| M-5 | Invalid modification requests return a clear error or "no changes needed" response. |

---

## 7. AI Chat (Conversational)

### 7.1 Goal
A general-purpose chat interface for trip-related questions and advice.

### 7.2 Behavior
- Maintains conversation history (last 5 interactions stored in DB).
- Has context: trip destination, dates, travelers, current attractions/restaurants.
- Can answer questions about the destination, suggest activities, give travel tips.
- Personalizes responses based on traveler ages (e.g., kid-friendly suggestions).

### 7.3 Acceptance Criteria
| # | Criterion |
|---|-----------|
| C-1 | Chat messages and responses are persisted in `ai_interactions`. |
| C-2 | Chat has access to trip context (destination, dates, travelers). |
| C-3 | Conversation history is maintained across page reloads. |
| C-4 | The AI responds within the scope of travel planning (not arbitrary topics). |

---

## 8. Travel Time & Distance

### 8.1 Goal
Show realistic travel times between activities.

### 8.2 Calculation Chain
1. **Primary**: Google Maps Distance Matrix API (if `GOOGLE_MAPS_API_KEY` configured).
   - Mode: driving (default), with real-time traffic (`departure_time: now`).
   - Prefers `duration_in_traffic` over basic duration.
2. **Fallback**: Haversine formula with 30 km/h average speed.

### 8.3 Origin Logic
- First activity of the day: origin = hotel.
- Subsequent activities: origin = previous activity's location.
- When a selection changes, travel times for downstream blocks recalculate.

### 8.4 Map Links
Each suggestion should provide:
- A "View on Maps" link (Google Maps search).
- A "Get Directions" link from the origin location.

### 8.5 Acceptance Criteria
| # | Criterion |
|---|-----------|
| D-1 | Travel time API returns distance (meters + text) and duration (seconds + text). |
| D-2 | Without Google API key, Haversine fallback produces reasonable estimates. |
| D-3 | Changing a time block selection recalculates downstream travel times. |
| D-4 | Map links open valid Google Maps URLs with correct coordinates. |

---

## 9. Version Navigation

### 9.1 Goal
Users can browse previous plan versions and understand what changed.

### 9.2 Behavior
- Version list is available on the trip page.
- Navigating to a version loads its time blocks.
- The latest version is shown by default.

### 9.3 Acceptance Criteria
| # | Criterion |
|---|-----------|
| V-1 | All plan versions for a trip are retrievable, ordered by version number. |
| V-2 | Selecting a previous version displays its time blocks (not the latest). |
| V-3 | The current version number and total count are displayed. |

---

## 10. Offline Support

### 10.1 Goal
The app remains usable (read-only) when the network is unavailable.

### 10.2 Behavior
- Trip data, city data, and time blocks are cached in `localStorage`.
- Cache has a 7-day TTL.
- When offline:
  - Cached data is displayed.
  - A visible banner indicates offline/read-only mode.
  - Write operations (selections, AI requests) are disabled.
- When connectivity returns:
  - The banner updates to indicate online status.
  - Write operations re-enable.

### 10.3 Acceptance Criteria
| # | Criterion |
|---|-----------|
| O-1 | After loading a trip while online, the trip is viewable offline. |
| O-2 | An offline banner is displayed when the network is unavailable. |
| O-3 | Write operations are blocked offline (no silent failures). |
| O-4 | Cached data expires after 7 days. |
| O-5 | Quota exceeded errors on localStorage are handled gracefully. |

---

## 11. Dashboard & Trip Management

### 11.1 Dashboard
- Lists all trips for the authenticated user.
- Shows trip metadata: destination, dates, traveler count.
- Shows status: Upcoming / Planning / Completed (derived from dates).
- Aggregate stats: total trips, total destinations, total travel days.

### 11.2 Trip Deletion
- Only the trip owner can delete.
- Requires confirmation (two-step UI).
- Cascades to all related records (cities, travelers, flights, hotels, attractions, restaurants, time blocks, versions, interactions).

### 11.3 Acceptance Criteria
| # | Criterion |
|---|-----------|
| H-1 | Dashboard shows all and only the authenticated user's trips. |
| H-2 | Trip status is correctly computed from dates relative to today. |
| H-3 | Deleting a trip removes it and all related data. |
| H-4 | Non-owners cannot delete a trip. |

---

## 12. Data Model

### 12.1 Tables

```
users
  id (PK, FK → auth.users)
  email

trips
  id (PK), user_id (FK → users), destination, start_date, end_date

trip_cities
  id (PK), trip_id (FK → trips), name, start_date, end_date, order_index

trip_collaborators
  id (PK), trip_id (FK → trips), user_id (FK → users), role (owner|editor|viewer)
  UNIQUE(trip_id, user_id)

travelers
  id (PK), trip_id (FK → trips), name, age, relationship

flights
  id (PK), trip_id (FK → trips), date, departure_airport, arrival_airport,
  departure_time, arrival_time, flight_number, airline

hotels
  id (PK), trip_id (FK → trips), city_id (FK → trip_cities, nullable),
  name, address, check_in_date, check_out_date, latitude, longitude

attractions
  id (PK), trip_id (FK → trips), city_id (FK → trip_cities),
  name, description, image_url, highlights[], latitude, longitude,
  opening_time, closing_time, duration_minutes, category,
  is_kid_friendly, min_age

restaurants
  id (PK), trip_id (FK → trips), city_id (FK → trip_cities),
  name, description, image_url, highlights[], latitude, longitude,
  opening_time, closing_time, cuisine_type, price_level (1-4),
  is_kid_friendly

plan_versions
  id (PK), trip_id (FK → trips), version_number, plan_data (JSONB),
  created_by (FK → users)
  UNIQUE(trip_id, version_number)

time_blocks
  id (PK), trip_id (FK → trips), plan_version_id (FK → plan_versions),
  city_id (FK → trip_cities), date,
  block_type (morning|lunch|afternoon|dinner|evening),
  start_time, end_time,
  selected_attraction_id (FK → attractions, nullable),
  selected_restaurant_id (FK → restaurants, nullable)

ai_interactions
  id (PK), trip_id (FK → trips), user_id (FK → users), message, response
```

### 12.2 Security Invariants
- RLS enabled on every table.
- All child tables use a `has_trip_access(trip_id)` check that verifies the user is the owner or a collaborator.
- `trip_collaborators` SELECT requires either being the trip owner or a collaborator on that trip.
- The `has_trip_access` function runs as `SECURITY DEFINER` to avoid infinite recursion between trips and trip_collaborators policies.
- Cascading deletes: deleting a trip removes all child records.

---

## 13. Tech Stack Constraints

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14+ (App Router) | Server + Client components |
| Database | Supabase (PostgreSQL + Auth + RLS) | |
| AI | Anthropic Claude API | Sonnet model for all AI tasks |
| Styling | Tailwind CSS | Mobile-first responsive |
| Language | TypeScript (strict) | No `any` types |
| Deployment | Vercel | Uses `VERCEL_URL` for app URL |

### 13.1 Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | Supabase anon key |
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `GOOGLE_MAPS_API_KEY` | No | Real travel times + place photos |
| `NEXT_PUBLIC_APP_URL` | No | Override app URL (dev only) |

---

## 14. Testing Requirements

This section defines what a passing test suite must verify. See the acceptance criteria tables in each section above for specifics (IDs: A-*, T-*, S-*, I-*, M-*, C-*, D-*, V-*, O-*, H-*).

### 14.1 Unit Test Coverage

**Utility functions** — Pure functions with deterministic I/O:
- Haversine distance calculation (known coordinate pairs → known distances)
- Travel time estimation (distance → minutes at 30 km/h)
- Time string parsing (HH:MM, HH:MM:SS, edge cases)
- `isOpenAt` checks (time within range, crossing midnight, null hours = always open)
- Timeline calculations (activity start/end times, next activity starts, default durations)
- Markdown code fence stripping from AI responses
- Itinerary validation (date ranges, duplicates, distribution, first-day check)
- Offline cache operations (set, get, expire, quota exceeded)
- URL generation (maps search links, directions links)

**What to verify for each:**
- Happy path with typical inputs
- Edge cases (empty strings, null, midnight crossing, single-day trips)
- Error cases (invalid formats, out-of-range values)

### 14.2 API Route Tests

Each API route should be tested with mocked external dependencies (Supabase, Anthropic, Google Maps):

| Route | Key scenarios to test |
|-------|----------------------|
| `POST /api/ai/parse-trip` | Single city, multi-city, missing destination, missing dates, flight extraction, traveler age extraction, update existing trip |
| `POST /api/ai/generate-suggestions` | Generates correct count, handles API errors, validates JSON schema |
| `POST /api/ai/generate-itinerary` | Creates time blocks for all days, no duplicates, creates plan version, multi-city isolation |
| `POST /api/ai/modify-plan` | Creates new version, only changes affected blocks, cross-city validation, handles "no changes" |
| `POST /api/ai/chat` | Persists interaction, includes trip context, maintains history |
| `POST /api/travel-time` | Google Maps success, Google Maps fallback, invalid coordinates |
| `DELETE /api/trips/delete` | Owner can delete, non-owner rejected, nonexistent trip |

**What to verify for each:**
- Correct HTTP status codes (200, 400, 401, 404, 500)
- Response body structure matches expected schema
- Database writes are correct (mock Supabase and verify calls)
- AI prompt includes required context (mock Anthropic and verify prompt)
- Error responses are safe (no stack traces, no internal details)

### 14.3 Component Tests

| Component | Key behaviors to test |
|-----------|----------------------|
| AuthForm | Toggle login/signup/reset modes, form submission, error display, loading state |
| MessageBasedTripCreator | Multi-step progress (parsing → suggestions → itinerary), error handling, auto-navigation |
| MultiCityTimeline | View mode toggle (selection ↔ timeline), version navigation, offline fallback |
| CitySection | Loads attractions/restaurants, selection persistence, regeneration, expand/collapse |
| DayCard | Renders flights/hotels/blocks, calculates timeline order, handles empty days |
| TimeBlockCard | Suggestion carousel, selection/deselection, origin calculation, travel time display |
| OfflineBanner | Shows when offline, hides when online, optional online indicator |
| PlanModifier | Submit modification, version navigation, loading/feedback states |

### 14.4 Integration Tests (Optional — Require API Keys)
- Google Maps Distance Matrix: real coordinates → real travel time
- Google Places: real place name → photo URL

### 14.5 E2E Tests

Critical user journeys that should be tested end-to-end:

| Journey | Steps |
|---------|-------|
| **Signup → First Trip** | Sign up → Confirm email → Describe trip → See itinerary |
| **Login → Dashboard** | Sign in → See trip list → Open a trip |
| **Trip Creation** | Type natural language → See progress → See generated itinerary with time blocks |
| **Multi-City Trip** | Describe multi-city trip → Verify both cities have suggestions and itineraries |
| **Plan Modification** | Open trip → Request AI modification → Verify new version created → Navigate versions |
| **Time Block Selection** | Open timeline → Select attraction → Verify it disappears from other blocks |
| **Trip Deletion** | Dashboard → Delete trip → Confirm → Verify removed from dashboard |
| **Auth Protection** | Attempt to access trip page without login → Redirected to login |

### 14.6 AI Response Validation

Since AI outputs are non-deterministic, tests should verify **structural correctness** rather than exact content:

- Response is valid JSON (after markdown stripping)
- Required fields are present and correctly typed
- Coordinates are within plausible geographic bounds for the city
- No duplicate names in suggestion lists
- Time formats match HH:MM pattern
- `city_id` assignments are consistent (no cross-city leaks)
- Itinerary covers all dates in range
- No attraction/restaurant appears in multiple time blocks

---

## 15. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Build | `npm run build` succeeds with zero TypeScript errors |
| Lint | `npm run lint` passes with zero errors |
| Tests | `npm test` passes all unit/API/component tests |
| Auth latency | Login/signup completes in < 3 seconds |
| AI suggestion generation | Completes within 30 seconds per city |
| Itinerary generation | Completes within 30 seconds per city |
| Mobile responsive | Usable on 375px width screens |
| Accessibility | All interactive elements keyboard-navigable |

---

## Appendix A: Example Test Scenarios

### A.1 Trip Parsing — Multi-City
**Input**: "Going to Santiago Jan 10-14 then Pucon Jan 14-18 with Maria (36) and kids Tomas (10), Sofia (7)"

**Expected output:**
- 2 cities: Santiago (Jan 10-14, order 0), Pucon (Jan 14-18, order 1)
- 3 travelers: Maria (36), Tomas (10), Sofia (7)
- ~10 attractions + ~10 restaurants per city (20+20 total)
- Time blocks for Jan 10-14 tagged with Santiago's city_id
- Time blocks for Jan 14-18 tagged with Pucon's city_id

### A.2 Itinerary Validation — No Duplicates
**Setup**: City with 5 days, 8 attractions, 6 restaurants

**Verify:**
- Each attraction appears in at most 1 time block
- Each restaurant appears in at most 1 time block
- At least 3 of 5 days have morning activities
- Day 1 has at least 1 activity

### A.3 Travel Time — Fallback
**Setup**: No `GOOGLE_MAPS_API_KEY` configured

**Input**: Two points 10km apart (by Haversine)

**Expected**: ~20 minutes travel time (10km ÷ 30 km/h)

### A.4 Offline Cache — Expiry
**Setup**: Cache a trip with timestamp 8 days ago

**Verify**: `getCachedTripData()` returns null (expired past 7-day TTL)

### A.5 Plan Modification — Cross-City Guard
**Setup**: Trip with City A (attractions A1, A2) and City B (attractions B1, B2)

**Modify**: Request that should only affect City A

**Verify**: No time block in City B references A1 or A2
