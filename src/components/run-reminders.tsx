"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

type Variant = { subject: string; body: string };

type Props = {
  lastRunAt?: string | null;
  cronIntervalHours?: number;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function RunReminders({ lastRunAt, cronIntervalHours = 24 }: Props) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const { addToast } = useToast();
  const router = useRouter();

  const generateVariants = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/reminders/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: true })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "AI failed");
      }
      setVariants(data.variants || []);
      setSelected(null);
    } catch (error) {
      addToast({
        title: "AI failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setGenerating(false);
    }
  };

  const run = async () => {
    setLoading(true);
    const payload =
      selected !== null && variants[selected]
        ? {
            subject_template: variants[selected].subject,
            body_template: variants[selected].body
          }
        : {};

    const response = await fetch("/api/reminders/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
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

  const nextRunAt =
    lastRunAt && cronIntervalHours
      ? new Date(new Date(lastRunAt).getTime() + cronIntervalHours * 60 * 60 * 1000)
      : null;

  return (
    <div className="card p-4 space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-700">Run reminder engine</p>
        <p className="text-xs text-slate-500">
          Sends polite reminders at 7, 14, and 21 days past due.
        </p>
        <div className="text-xs text-slate-500">
          <p>
            Last run: {lastRunAt ? formatDateTime(lastRunAt) : "Not run yet"}
          </p>
          <p>
            Next auto run:{" "}
            {nextRunAt
              ? formatDateTime(nextRunAt.toISOString())
              : `Every ${cronIntervalHours}h (cron not run yet)`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="button" type="button" onClick={run} disabled={loading}>
          {loading ? "Running..." : "Run reminders"}
        </button>
        <button
          className="button-secondary"
          type="button"
          onClick={generateVariants}
          disabled={generating}
        >
          {generating ? "Generating..." : "Generate variants"}
        </button>
        {selected !== null && (
          <button
            className="button-secondary"
            type="button"
            onClick={() => setSelected(null)}
          >
            Clear selection
          </button>
        )}
      </div>

      {variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Select a variant to use for every reminder in this run.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {variants.map((variant, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelected(index)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected === index
                    ? "border-slate-900 bg-white"
                    : "border-slate-200/70 bg-white/70"
                }`}
              >
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Variant {index + 1}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  {variant.subject}
                </p>
                <p className="mt-2 text-xs text-slate-500 line-clamp-4">{variant.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
