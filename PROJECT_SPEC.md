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

---

## 2. Authentication

- Email/password authentication via Supabase Auth.
- Password reset flow (email link → reset form).
- Unauthenticated users cannot access any trip data.
- Users can only access their own trips. All database tables enforce Row-Level Security.

### Acceptance Criteria
| # | Criterion |
|---|-----------|
| A-1 | A new user can sign up, sign in, and is redirected to the dashboard. |
| A-2 | An unauthenticated user cannot access `/dashboard` or any trip page. |
| A-3 | A user cannot read or write another user's trip data. |

---

## 3. Trip Creation (Natural Language Parsing)

### Goal
Accept a single free-text message and produce a complete trip structure.

### Input
A natural-language string such as:
> "We're going to Santiago Jan 10-14 then Pucon Jan 14-18. Family of 4 — me (38), wife Maria (36), kids Tomas (10) and Sofia (7). Flying LATAM LA401 from Lima 8am arriving Santiago 1pm."

### Required Extraction
The AI must extract and create records for:

| Entity | Required Fields | Notes |
|--------|----------------|-------|
| **Cities** | name, start_date, end_date, order_index | Multiple cities supported. Assume current year if omitted. |
| **Travelers** | name, age, relationship | Infer ages from context ("my 7-year-old son"). |
| **Flights** | date, departure/arrival airport & time, airline, flight_number | Optional — only if mentioned. |
| **Hotels** | name, address, check_in/check_out dates, latitude, longitude, city assignment | Optional — only if mentioned. Coordinates must be realistic for the city. |

### Post-Parsing Pipeline
After extraction the system must automatically:
1. Create all database records (trip, cities, travelers, flights, hotels).
2. Generate AI suggestions (attractions + restaurants) for **each city**.
3. Generate an AI itinerary (time blocks) for **each city** using the generated suggestions.

### Acceptance Criteria
| # | Criterion |
|---|-----------|
| T-1 | A single-city trip message produces a trip with 1 city, correct dates, and travelers. |
| T-2 | A multi-city trip message (e.g., "Santiago then Pucon") produces multiple cities with correct date ranges and order. |
| T-3 | Traveler ages are correctly extracted and stored. |
| T-4 | Flight details are extracted when present; omitted fields are handled gracefully. |
| T-5 | After parsing, each city has ~10 attractions and ~10 restaurants. |
| T-6 | After parsing, time blocks exist for every day of every city. |
| T-7 | Attractions/restaurants are assigned to the correct city — never cross-city. |
| T-8 | If the message is too vague (no destination or dates), the API returns a clear error. |

---

## 4. AI Suggestion Generation

### Goal
For a given city and traveler group, produce a pool of attractions and restaurants.

### Output Schema — Attractions (×10 per city)

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

### Output Schema — Restaurants (×10 per city)

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

### Acceptance Criteria
| # | Criterion |
|---|-----------|
| S-1 | Each city gets approximately 10 attractions and 10 restaurants. |
| S-2 | All coordinates are geographically plausible for the named city. |
| S-3 | When travelers include young children, some suggestions are marked kid-friendly. |
| S-4 | Suggestions include a mix of categories (not all museums, not all parks). |
| S-5 | Opening/closing times are in HH:MM format or null. |
| S-6 | No duplicate names within a city's suggestion pool. |
| S-7 | Each suggestion is linked to the correct city. |

---

## 5. Itinerary Generation (Time Block Scheduling)

### Goal
Given a city's date range and suggestion pool, produce a day-by-day schedule.

### Time Block Structure
Each day is divided into up to 5 blocks:

| Block Type | Default Window | Content |
|------------|---------------|---------|
| morning | 09:00 – 12:00 | Attraction |
| lunch | 12:00 – 13:30 | Restaurant |
| afternoon | 13:30 – 17:00 | Attraction |
| dinner | 18:00 – 20:00 | Restaurant |
| evening | 20:00+ | Attraction (optional) |

### Scheduling Rules
1. **No duplicate assignments** — An attraction or restaurant appears in at most one time block across the entire plan.
2. **Respect opening hours** — An attraction assigned to "morning" must be open during morning hours.
3. **Even distribution** — If there are N days and M attractions, spread them; at least 50% of days should have activities (when enough attractions exist).
4. **First day has activities** — Unless it's a travel-only day, the first day should not be empty.
5. **Arrival day adjustment** — If there's a late-arriving flight, skip morning/afternoon blocks.
6. **Kid-friendly preference** — When young children are in the group, prefer kid-friendly options.

### Multi-City Behavior
- Each city's itinerary is generated independently.
- Generating/regenerating one city's itinerary must not destroy another city's time blocks.

### Version Control
- Each itinerary generation creates a new plan version with an incrementing version number.
- Time blocks reference their plan version.

### Acceptance Criteria
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

### Goal
Users can request changes to the current plan via natural language. The system modifies the relevant time blocks and produces a new version.

### Modification Flow
1. User submits a modification request (e.g., "Replace indoor activities with outdoor ones").
2. System sends current plan state + request to AI.
3. AI returns only the **changed** time blocks (not the full plan).
4. System validates changes:
   - Attractions/restaurants must belong to the correct city.
   - Referenced IDs must exist in the database.
5. System creates a new plan version with changes applied.

### Acceptance Criteria
| # | Criterion |
|---|-----------|
| M-1 | A modification request produces a new plan version with a higher version number. |
| M-2 | Only the affected time blocks are changed; others remain intact. |
| M-3 | The AI cannot assign an attraction from City A to a time block in City B. |
| M-4 | The response includes a summary of what was changed. |
| M-5 | Invalid modification requests return a clear error or "no changes needed" response. |

---

## 7. AI Chat (Conversational)

### Goal
A general-purpose chat interface for trip-related questions and advice.

### Behavior
- Maintains conversation history (recent interactions stored in DB).
- Has context: trip destination, dates, travelers, current attractions/restaurants.
- Can answer questions about the destination, suggest activities, give travel tips.
- Personalizes responses based on traveler ages (e.g., kid-friendly suggestions).

### Acceptance Criteria
| # | Criterion |
|---|-----------|
| C-1 | Chat messages and responses are persisted. |
| C-2 | Chat has access to trip context (destination, dates, travelers). |
| C-3 | Conversation history is maintained across page reloads. |
| C-4 | The AI responds within the scope of travel planning (not arbitrary topics). |

---

## 8. Travel Time & Distance

### Goal
Show realistic travel times between activities.

### Origin Logic
- First activity of the day: origin = hotel.
- Subsequent activities: origin = previous activity's location.
- When a selection changes, travel times for downstream blocks recalculate.

### Map Links
Each suggestion should provide:
- A "View on Maps" link (Google Maps search).
- A "Get Directions" link from the origin location.

### Acceptance Criteria
| # | Criterion |
|---|-----------|
| D-1 | Travel time between two locations is computed and displayed. |
| D-2 | Changing a time block selection recalculates downstream travel times. |
| D-3 | Map links open valid Google Maps URLs with correct coordinates. |

---

## 9. Version Navigation

### Goal
Users can browse previous plan versions and understand what changed.

### Behavior
- Version list is available on the trip page.
- Navigating to a version loads its time blocks.
- The latest version is shown by default.

### Acceptance Criteria
| # | Criterion |
|---|-----------|
| V-1 | All plan versions for a trip are retrievable, ordered by version number. |
| V-2 | Selecting a previous version displays its time blocks (not the latest). |
| V-3 | The current version number and total count are displayed. |

---

## 10. Dashboard & Trip Management

### Dashboard
- Lists all trips for the authenticated user.
- Shows trip metadata: destination, dates, traveler count.
- Shows status: Upcoming / Planning / Completed (derived from dates).

### Trip Deletion
- Only the trip owner can delete.
- Requires confirmation.
- Cascades to all related records.

### Acceptance Criteria
| # | Criterion |
|---|-----------|
| H-1 | Dashboard shows all and only the authenticated user's trips. |
| H-2 | Trip status is correctly computed from dates relative to today. |
| H-3 | Deleting a trip removes it and all related data. |

---

## 11. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| AI | Anthropic Claude API |
| Styling | Tailwind CSS (mobile-first) |
| Language | TypeScript (strict) |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | Supabase anon key |
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `GOOGLE_MAPS_API_KEY` | No | Travel times + place photos |

---

## 12. Testing

Testing is highly encouraged at all layers. The acceptance criteria in each section above (IDs: A-\*, T-\*, S-\*, I-\*, M-\*, C-\*, D-\*, V-\*, H-\*) serve as the verification checklist.

Since AI outputs are non-deterministic, tests should verify **structural correctness** rather than exact content — valid JSON, required fields present and correctly typed, coordinates within plausible bounds, no duplicates, time format consistency, no cross-city leaks, itinerary covers all dates, and no attraction/restaurant assigned to multiple time blocks.

---

## Appendix: Example Scenarios

### A.1 Trip Parsing — Multi-City
**Input**: "Going to Santiago Jan 10-14 then Pucon Jan 14-18 with Maria (36) and kids Tomas (10), Sofia (7)"

**Expected:**
- 2 cities: Santiago (Jan 10-14, order 0), Pucon (Jan 14-18, order 1)
- 3 travelers: Maria (36), Tomas (10), Sofia (7)
- ~10 attractions + ~10 restaurants per city
- Time blocks for Jan 10-14 tagged with Santiago
- Time blocks for Jan 14-18 tagged with Pucon

### A.2 Itinerary Validation — No Duplicates
**Setup**: City with 5 days, 8 attractions, 6 restaurants

**Verify:**
- Each attraction appears in at most 1 time block
- Each restaurant appears in at most 1 time block
- At least 3 of 5 days have morning activities
- Day 1 has at least 1 activity

### A.3 Plan Modification — Cross-City Guard
**Setup**: Trip with City A (attractions A1, A2) and City B (attractions B1, B2)

**Modify**: Request that should only affect City A

**Verify**: No time block in City B references A1 or A2
