export const PARSE_TRIP_PROMPT = `You are a travel planning assistant. Parse the user's natural language trip description and extract structured data.

Extract the following:
- cities: Array of cities with name, country (if inferable), start_date, end_date, and city_order (0-indexed)
- travelers: Array of travelers with name, age, and relationship
- flights: Array of flights with date, departure_airport, arrival_airport, departure_time (HH:MM), arrival_time (HH:MM), flight_number, airline
- hotels: Array of hotels with name, address, check_in_date, check_out_date, latitude, longitude, and the city_name it belongs to

Rules:
- If the year is not specified, assume the next occurrence of the date.
- For multi-city trips, determine date ranges for each city from context.
- The trip destination should be a comma-separated list of city names.
- The overall trip start_date is the earliest city start_date, end_date is the latest city end_date.
- If hotel coordinates are not inferable, use approximate city center coordinates.
- If information is missing, use null for optional fields.
- If the message is too vague (no destination or no dates), set "error" field with a description.

Respond with ONLY valid JSON in this exact format:
{
  "error": null,
  "destination": "City1, City2",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "cities": [
    {
      "name": "City Name",
      "country": "Country",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "city_order": 0,
      "latitude": -33.4489,
      "longitude": -70.6693
    }
  ],
  "travelers": [
    { "name": "Name", "age": 30, "relationship": "self" }
  ],
  "flights": [
    {
      "date": "YYYY-MM-DD",
      "departure_airport": "ABC",
      "arrival_airport": "DEF",
      "departure_time": "08:00",
      "arrival_time": "13:00",
      "flight_number": "LA401",
      "airline": "LATAM"
    }
  ],
  "hotels": [
    {
      "name": "Hotel Name",
      "address": "Address",
      "check_in_date": "YYYY-MM-DD",
      "check_out_date": "YYYY-MM-DD",
      "latitude": -33.4489,
      "longitude": -70.6693,
      "city_name": "City Name"
    }
  ]
}`;

export function buildSuggestionsPrompt(
  cityName: string,
  country: string | null,
  travelers: { name: string; age: number | null }[]
): string {
  const hasKids = travelers.some((t) => t.age !== null && t.age < 12);
  const travelerDesc = travelers
    .map((t) => `${t.name}${t.age ? ` (age ${t.age})` : ""}`)
    .join(", ");

  return `Generate travel suggestions for ${cityName}${country ? `, ${country}` : ""}.

Travelers: ${travelerDesc}
${hasKids ? "IMPORTANT: Include kid-friendly options since there are young children in the group." : ""}

Generate exactly 10 attractions and 10 restaurants. Each must have REAL coordinates for ${cityName}.

For attractions, include a mix of categories: museums, parks, landmarks, cultural sites, viewpoints, markets, etc.
For restaurants, include a mix of cuisines and price levels.

Respond with ONLY valid JSON:
{
  "attractions": [
    {
      "name": "Attraction Name",
      "description": "Brief description",
      "highlights": ["highlight1", "highlight2"],
      "latitude": -33.4489,
      "longitude": -70.6693,
      "opening_time": "09:00",
      "closing_time": "18:00",
      "duration_minutes": 120,
      "category": "museum",
      "is_kid_friendly": true,
      "min_age": 0
    }
  ],
  "restaurants": [
    {
      "name": "Restaurant Name",
      "description": "Brief description",
      "highlights": ["highlight1", "highlight2"],
      "latitude": -33.4500,
      "longitude": -70.6700,
      "opening_time": "12:00",
      "closing_time": "23:00",
      "cuisine_type": "Chilean",
      "price_level": 2,
      "is_kid_friendly": true
    }
  ]
}

Rules:
- All coordinates must be geographically accurate for ${cityName}
- opening_time/closing_time in HH:MM format, or null if always open
- No duplicate names
- duration_minutes for attractions (30-240 range)
- price_level: 1=budget, 2=moderate, 3=upscale, 4=fine dining
- category examples: museum, park, landmark, market, cultural, viewpoint, beach, nature, historic
- Ensure variety in categories and cuisines`;
}

export function buildItineraryPrompt(
  cityName: string,
  startDate: string,
  endDate: string,
  attractions: { id: string; name: string; opening_time: string | null; closing_time: string | null; duration_minutes: number | null; is_kid_friendly: boolean; category: string }[],
  restaurants: { id: string; name: string; opening_time: string | null; closing_time: string | null; cuisine_type: string; is_kid_friendly: boolean }[],
  travelers: { name: string; age: number | null }[],
  arrivalTime?: string | null
): string {
  const hasKids = travelers.some((t) => t.age !== null && t.age < 12);

  return `Create a daily itinerary for ${cityName} from ${startDate} to ${endDate}.

Available attractions:
${attractions.map((a) => `- ID: ${a.id}, Name: ${a.name}, Hours: ${a.opening_time || "always"}-${a.closing_time || "open"}, Duration: ${a.duration_minutes || 90}min, Category: ${a.category}, Kid-friendly: ${a.is_kid_friendly}`).join("\n")}

Available restaurants:
${restaurants.map((r) => `- ID: ${r.id}, Name: ${r.name}, Hours: ${r.opening_time || "always"}-${r.closing_time || "open"}, Cuisine: ${r.cuisine_type}, Kid-friendly: ${r.is_kid_friendly}`).join("\n")}

${hasKids ? "IMPORTANT: Prefer kid-friendly options since there are young children." : ""}
${arrivalTime ? `NOTE: On ${startDate}, arrival is at ${arrivalTime}. Skip blocks before arrival time.` : ""}

Time block structure per day:
- morning: 09:00-12:00 (attraction)
- lunch: 12:00-13:30 (restaurant)
- afternoon: 13:30-17:00 (attraction)
- dinner: 18:00-20:00 (restaurant)
- evening: 20:00-22:00 (attraction, optional)

Rules:
1. Each attraction/restaurant can appear in AT MOST ONE time block across all days.
2. Respect opening hours - don't assign a place to a time when it's closed.
3. Distribute activities evenly across days. Don't cluster everything on day 1.
4. At least 50% of days should have morning activities (when enough attractions exist).
5. Day 1 must have at least 1 activity (unless it's arrival-only).
6. Use null for attraction_id/restaurant_id if a block should be empty.

Respond with ONLY valid JSON:
{
  "summary": "Brief human-readable summary of the itinerary",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "blocks": [
        {
          "block_type": "morning",
          "start_time": "09:00",
          "end_time": "12:00",
          "attraction_id": "uuid-here-or-null",
          "restaurant_id": null
        },
        {
          "block_type": "lunch",
          "start_time": "12:00",
          "end_time": "13:30",
          "attraction_id": null,
          "restaurant_id": "uuid-here-or-null"
        }
      ]
    }
  ]
}`;
}

export function buildModifyPlanPrompt(
  request: string,
  cityName: string,
  currentBlocks: {
    id: string;
    date: string;
    block_type: string;
    attraction_id: string | null;
    attraction_name: string | null;
    restaurant_id: string | null;
    restaurant_name: string | null;
  }[],
  availableAttractions: { id: string; name: string; category: string; is_kid_friendly: boolean; city_id: string }[],
  availableRestaurants: { id: string; name: string; cuisine_type: string; is_kid_friendly: boolean; city_id: string }[],
  cityId: string
): string {
  return `Modify the travel plan for ${cityName} based on this request: "${request}"

Current time blocks:
${currentBlocks.map((b) => `- ${b.date} ${b.block_type}: ${b.attraction_name || b.restaurant_name || "empty"} (block ID: ${b.id})`).join("\n")}

Available attractions for ${cityName} (city_id: ${cityId}):
${availableAttractions.filter((a) => a.city_id === cityId).map((a) => `- ID: ${a.id}, Name: ${a.name}, Category: ${a.category}`).join("\n")}

Available restaurants for ${cityName} (city_id: ${cityId}):
${availableRestaurants.filter((r) => r.city_id === cityId).map((r) => `- ID: ${r.id}, Name: ${r.name}, Cuisine: ${r.cuisine_type}`).join("\n")}

Rules:
1. Only return CHANGED time blocks, not the entire plan.
2. Only use attractions/restaurants from the list above (belonging to this city).
3. Never assign an attraction from a different city.
4. If the request is unclear or no changes are needed, set changes to empty array.

Respond with ONLY valid JSON:
{
  "summary": "Description of what was changed",
  "changes": [
    {
      "block_id": "existing-block-uuid",
      "attraction_id": "new-attraction-uuid-or-null",
      "restaurant_id": "new-restaurant-uuid-or-null"
    }
  ]
}`;
}

export function buildChatPrompt(
  message: string,
  tripDestination: string,
  dates: { start: string; end: string },
  travelers: { name: string; age: number | null }[],
  cities: { name: string; country: string | null }[],
  recentHistory: { message: string; response: string }[]
): string {
  const historyStr = recentHistory
    .map((h) => `User: ${h.message}\nAssistant: ${h.response}`)
    .join("\n\n");

  return `You are a travel planning assistant for a trip to ${tripDestination} (${dates.start} to ${dates.end}).

Cities: ${cities.map((c) => c.name).join(", ")}
Travelers: ${travelers.map((t) => `${t.name}${t.age ? ` (age ${t.age})` : ""}`).join(", ")}

${historyStr ? `Recent conversation:\n${historyStr}\n` : ""}

Respond helpfully about travel planning, destination advice, activities, food, culture, practical tips, etc. Stay focused on travel planning topics. Personalize advice based on traveler ages and group composition.

User message: ${message}`;
}
