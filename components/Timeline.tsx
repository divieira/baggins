"use client";

import type { TimeBlock, Attraction, Restaurant } from "@/types/database";
import TravelTimeDisplay from "./TravelTimeDisplay";

interface TimelineProps {
  blocks: (TimeBlock & { attraction?: Attraction | null; restaurant?: Restaurant | null })[];
  date: string;
}

const BLOCK_COLORS: Record<string, string> = {
  morning: "border-l-yellow-400 bg-yellow-50",
  lunch: "border-l-orange-400 bg-orange-50",
  afternoon: "border-l-blue-400 bg-blue-50",
  dinner: "border-l-red-400 bg-red-50",
  evening: "border-l-purple-400 bg-purple-50",
};

const BLOCK_LABELS: Record<string, string> = {
  morning: "Morning",
  lunch: "Lunch",
  afternoon: "Afternoon",
  dinner: "Dinner",
  evening: "Evening",
};

export default function Timeline({ blocks, date }: TimelineProps) {
  const sortedBlocks = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time));

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3">{formattedDate}</h3>
      <div className="space-y-2">
        {sortedBlocks.map((block, index) => {
          const place = block.attraction || block.restaurant;
          const colorClass = BLOCK_COLORS[block.block_type] || "border-l-gray-400 bg-gray-50";
          const label = BLOCK_LABELS[block.block_type] || block.block_type;

          // Calculate travel time from previous block
          const prevBlock = index > 0 ? sortedBlocks[index - 1] : null;
          const prevPlace = prevBlock ? (prevBlock.attraction || prevBlock.restaurant) : null;

          return (
            <div key={block.id}>
              {prevPlace && place && (
                <TravelTimeDisplay
                  from={{
                    latitude: prevPlace.latitude,
                    longitude: prevPlace.longitude,
                    name: prevPlace.name,
                  }}
                  to={{
                    latitude: place.latitude,
                    longitude: place.longitude,
                    name: place.name,
                  }}
                />
              )}
              <div className={`border-l-4 rounded-r-lg p-4 ${colorClass}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {block.start_time} - {block.end_time}
                  </span>
                </div>
                {place ? (
                  <div>
                    <p className="font-medium">{place.name}</p>
                    <p className="text-sm text-gray-600">{place.description}</p>
                    {place.highlights && place.highlights.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {place.highlights.slice(0, 3).map((h, i) => (
                          <span key={i} className="text-xs bg-white/60 px-2 py-0.5 rounded">
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Free time</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
