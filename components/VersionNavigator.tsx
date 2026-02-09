"use client";

import type { PlanVersion } from "@/types/database";

interface VersionNavigatorProps {
  versions: PlanVersion[];
  currentVersion: number;
  onVersionChange: (versionId: string, versionNumber: number) => void;
}

export default function VersionNavigator({
  versions,
  currentVersion,
  onVersionChange,
}: VersionNavigatorProps) {
  if (versions.length <= 1) return null;

  const sorted = [...versions].sort((a, b) => a.version_number - b.version_number);
  const currentIdx = sorted.findIndex((v) => v.version_number === currentVersion);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < sorted.length - 1;

  return (
    <div className="flex items-center gap-3 text-sm">
      <button
        onClick={() =>
          hasPrev && onVersionChange(sorted[currentIdx - 1].id, sorted[currentIdx - 1].version_number)
        }
        disabled={!hasPrev}
        className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
      >
        Prev
      </button>
      <span className="text-gray-600">
        Version {currentVersion} of {sorted.length}
      </span>
      <button
        onClick={() =>
          hasNext && onVersionChange(sorted[currentIdx + 1].id, sorted[currentIdx + 1].version_number)
        }
        disabled={!hasNext}
        className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
      >
        Next
      </button>
      {sorted[currentIdx]?.summary && (
        <span className="text-gray-400 text-xs truncate max-w-[200px]">
          {sorted[currentIdx].summary}
        </span>
      )}
    </div>
  );
}
