"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DashboardSummaryPayload } from "@/app/api/insights/dashboard-summary/route";

type Props = {
  payload: DashboardSummaryPayload;
};

export function DashboardSummary({ payload }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialFetched = useRef(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/dashboard-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Could not load summary.");
    } finally {
      setLoading(false);
    }
  }, [payload]);

  useEffect(() => {
    if (initialFetched.current) return;
    initialFetched.current = true;
    fetchSummary();
  }, [fetchSummary]);

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">AI summary</h2>
        <button
          type="button"
          onClick={fetchSummary}
          disabled={loading}
          className="button-secondary text-xs sm:text-sm shrink-0"
        >
          {loading ? "Generating..." : "Regenerate"}
        </button>
      </div>
      {loading && !summary ? (
        <p className="mt-2 text-sm text-slate-500">Generating summary…</p>
      ) : error ? (
        <p className="mt-2 text-sm text-amber-700">{error}</p>
      ) : summary ? (
        <p className="mt-2 text-sm text-slate-700 leading-relaxed">{summary}</p>
      ) : null}
    </section>
  );
}
