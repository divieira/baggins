"use client";

import { useState } from "react";

interface ModifyPlanProps {
  tripId: string;
  cityId: string;
  cityName: string;
  onModified: () => void;
}

export default function ModifyPlan({ tripId, cityId, cityName, onModified }: ModifyPlanProps) {
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/modify-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, city_id: cityId, request }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data.summary);
        setRequest("");
        onModified();
      } else {
        setError(data.error || "Failed to modify plan");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="font-semibold mb-2">Modify Plan for {cityName}</h3>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="e.g., 'Swap the morning museum for a park' or 'Add more kid-friendly activities'"
          className="input-field"
          disabled={loading}
        />
        <button type="submit" className="btn-primary text-sm" disabled={loading || !request.trim()}>
          {loading ? "Modifying..." : "Apply Changes"}
        </button>
      </form>
      {result && <p className="mt-2 text-sm text-green-700">{result}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
