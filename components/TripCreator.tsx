"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TripCreator() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/parse-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create trip");
        setLoading(false);
        return;
      }

      router.push(`/trips/${data.trip_id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Describe your trip in natural language... e.g., 'Family trip to Tokyo and Kyoto, July 10-20 2026, with my wife (age 35) and two kids (ages 8 and 5). Flying from LAX.'"
        className="input-field min-h-[100px] resize-y mb-3"
        disabled={loading}
      />
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <button type="submit" className="btn-primary" disabled={loading || !message.trim()}>
        {loading ? "Creating trip..." : "Plan My Trip"}
      </button>
    </form>
  );
}
