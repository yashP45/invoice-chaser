"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

export function RunReminders() {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();

  const run = async () => {
    setLoading(true);
    const response = await fetch("/api/reminders/run", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      addToast({
        title: "Reminder run failed",
        description: data.error || "Please try again.",
        variant: "error"
      });
    } else {
      addToast({
        title: "Reminders processed",
        description: `Sent ${data.sent} reminders. ${data.failed} failed.`,
        variant: data.failed > 0 ? "info" : "success"
      });
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <div className="card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">Run reminder engine</p>
        <p className="text-xs text-slate-500">
          Sends polite reminders at 7, 14, and 21 days past due.
        </p>
      </div>
      <button className="button" type="button" onClick={run} disabled={loading}>
        {loading ? "Running..." : "Run reminders"}
      </button>
    </div>
  );
}
