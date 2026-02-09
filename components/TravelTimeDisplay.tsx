"use client";

import { useEffect, useState } from "react";
import { haversineDistance, getDirectionsUrl } from "@/lib/travel-time";

interface Location {
  latitude: number;
  longitude: number;
  name: string;
}

interface TravelTimeDisplayProps {
  from: Location;
  to: Location;
}

export default function TravelTimeDisplay({ from, to }: TravelTimeDisplayProps) {
  const [travelInfo, setTravelInfo] = useState<{
    durationMinutes: number;
    distanceKm: number;
  } | null>(null);

  useEffect(() => {
    const distance = haversineDistance(
      { latitude: from.latitude, longitude: from.longitude },
      { latitude: to.latitude, longitude: to.longitude }
    );
    const avgSpeed = 30;
    const duration = Math.round((distance / avgSpeed) * 60);
    setTravelInfo({ durationMinutes: duration, distanceKm: Math.round(distance * 10) / 10 });
  }, [from.latitude, from.longitude, to.latitude, to.longitude]);

  if (!travelInfo || travelInfo.durationMinutes < 2) return null;

  const directionsUrl = getDirectionsUrl(from.latitude, from.longitude, to.latitude, to.longitude);

  return (
    <div className="flex items-center gap-2 py-1 px-4 ml-2">
      <div className="w-px h-4 bg-gray-300" />
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-400 hover:text-primary-600"
      >
        ~{travelInfo.durationMinutes} min ({travelInfo.distanceKm} km)
      </a>
    </div>
  );
}
