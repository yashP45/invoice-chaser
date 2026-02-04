"use client";

import { useState } from "react";
import { useToast } from "@/components/toast-provider";

type Variant = { subject: string; body: string };

export function ReminderVariants({ invoiceId }: { invoiceId: string }) {
  const { addToast } = useToast();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/reminders/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI failed");
      setVariants(data.variants || []);
      setSelected(null);
    } catch (error) {
      addToast({
        title: "AI failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI reminder variants</h3>
          <p className="text-xs text-slate-500">Generate 2–3 options before sending.</p>
        </div>
        <button className="button-secondary" type="button" onClick={generate} disabled={loading}>
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>
      {variants.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
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
              <p className="text-xs font-semibold uppercase text-slate-500">Variant {index + 1}</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">{variant.subject}</p>
              <p className="mt-2 text-xs text-slate-500 line-clamp-5">{variant.body}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Generate variants to review.</p>
      )}
    </div>
  );
}
