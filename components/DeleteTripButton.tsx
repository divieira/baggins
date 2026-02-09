"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function DeleteTripButton({ tripId }: { tripId: string }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async () => {
    await supabase.from("trips").delete().eq("id", tripId);
    router.refresh();
  };

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          className="text-red-600 text-sm font-medium hover:underline"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-gray-500 text-sm hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-gray-400 text-sm hover:text-red-600 transition-colors"
    >
      Delete
    </button>
  );
}
