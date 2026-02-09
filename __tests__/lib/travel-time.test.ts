import { haversineDistance } from "@/lib/travel-time";

describe("haversineDistance", () => {
  it("returns 0 for same coordinates", () => {
    const coord = { latitude: 40.7128, longitude: -74.006 };
    expect(haversineDistance(coord, coord)).toBe(0);
  });

  it("calculates distance between New York and Los Angeles approximately correctly", () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };
    const la = { latitude: 34.0522, longitude: -118.2437 };
    const distance = haversineDistance(nyc, la);
    // ~3940 km
    expect(distance).toBeGreaterThan(3900);
    expect(distance).toBeLessThan(4000);
  });

  it("calculates distance between London and Paris approximately correctly", () => {
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const distance = haversineDistance(london, paris);
    // ~344 km
    expect(distance).toBeGreaterThan(330);
    expect(distance).toBeLessThan(360);
  });

  it("returns the same distance regardless of direction", () => {
    const a = { latitude: 35.6762, longitude: 139.6503 }; // Tokyo
    const b = { latitude: -33.8688, longitude: 151.2093 }; // Sydney
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 5);
  });

  it("handles coordinates crossing the prime meridian", () => {
    const lisbon = { latitude: 38.7223, longitude: -9.1393 };
    const madrid = { latitude: 40.4168, longitude: -3.7038 };
    const distance = haversineDistance(lisbon, madrid);
    // ~502 km
    expect(distance).toBeGreaterThan(490);
    expect(distance).toBeLessThan(520);
  });
});
