# Integration Tests

These tests use **real API calls** to Google Maps and Google Places APIs.

## Requirements

1. **API Key**: Add `GOOGLE_MAPS_API_KEY` to `.env.local`
2. **Enabled APIs** in Google Cloud Console:
   - Distance Matrix API
   - Places API (Text Search + Place Photos)

## Running Integration Tests

The integration tests are designed to run in environments with native `fetch` support:

### Option 1: Run in Node 18+ with --experimental-fetch
```bash
node --experimental-fetch node_modules/.bin/jest __tests__/integration/
```

### Option 2: Run specific tests manually
The integration tests will gracefully skip if the API key is not configured.

```bash
npm test -- __tests__/integration/
```

### Option 3: Development/Production
The actual implementation code works perfectly in Next.js (server-side) and in browsers, where fetch is natively available.

## Test Coverage

### Google Maps Integration Tests (google-maps.integration.test.ts)
- Distance Matrix API with real locations
- Multiple travel modes (driving, walking, transit, bicycling)
- Traffic data integration
- Performance testing with parallel requests
- Edge cases (short distances, cross-city routes)

### Google Places Integration Tests (google-places.integration.test.ts)
- Place search by name and coordinates
- Photo URL fetching
- End-to-end flows (search → photo)
- Performance testing with parallel requests
- Special character handling

## Cost Implications

Running the full integration test suite:
- ~10 Distance Matrix API calls (~$0.05-0.10)
- ~15 Places API calls (~$0.21)
- **Total cost per run:** ~$0.26-0.31

Use sparingly on real API keys. The unit tests (mocked) provide sufficient coverage for CI/CD.

## Notes

- Unit tests use mocked `fetch` and test the logic without API costs
- Integration tests validate real API behavior and data
- Both test suites are valuable - unit tests for development, integration tests for verification
