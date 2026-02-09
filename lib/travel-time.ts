/**
 * Calculate travel time between two coordinates.
 * Uses Google Maps Distance Matrix API if available, otherwise falls back to Haversine formula.
 */

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface TravelTimeResult {
  durationMinutes: number;
  distanceKm: number;
  source: "google_maps" | "haversine_estimate";
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function haversineDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function calculateTravelTime(
  from: Coordinates,
  to: Coordinates
): Promise<TravelTimeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const origin = `${from.latitude},${from.longitude}`;
      const destination = `${to.latitude},${to.longitude}`;
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}&mode=driving`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.rows?.[0]?.elements?.[0]?.status === "OK") {
        const element = data.rows[0].elements[0];
        return {
          durationMinutes: Math.round(element.duration.value / 60),
          distanceKm: Math.round(element.distance.value / 1000 * 10) / 10,
          source: "google_maps",
        };
      }
    } catch {
      // Fall through to Haversine
    }
  }

  const distanceKm = haversineDistance(from, to);
  const averageSpeedKmh = 30;
  const durationMinutes = Math.round((distanceKm / averageSpeedKmh) * 60);

  return {
    durationMinutes,
    distanceKm: Math.round(distanceKm * 10) / 10,
    source: "haversine_estimate",
  };
}

export function getMapsUrl(name: string, lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=&query=${lat},${lng}`;
}

export function getDirectionsUrl(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=driving`;
}
