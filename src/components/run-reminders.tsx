"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { TokenTemplateFields } from "@/components/token-template-fields";

type Variant = { subject: string; body: string };

type PreviewInvoice = {
  invoice_id: string;
  invoice_number: string;
  client_name: string;
  missing_tokens: string[];
  ai_suggestions: Record<string, string>;
};

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
  const [previewInvoices, setPreviewInvoices] = useState<PreviewInvoice[] | null>(null);
  const [overridesByInvoice, setOverridesByInvoice] = useState<
    Record<string, Record<string, string>>
  >({});
  const { addToast } = useToast();
  const router = useRouter();

  const runPayload = useMemo(
    () =>
      selected !== null && variants[selected]
        ? {
            subject_template: variants[selected].subject,
            body_template: variants[selected].body
          }
        : {},
    [selected, variants]
  );

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
    setPreviewInvoices(null);
    try {
      const previewRes = await fetch("/api/reminders/run/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runPayload)
      });
      const previewData = await previewRes.json();
      if (!previewRes.ok) {
        addToast({
          title: "Preview failed",
          description: previewData.error || "Please try again.",
          variant: "error"
        });
        return;
      }
      const invoices = previewData.invoices ?? [];
      if (invoices.length === 0) {
        await executeRun({});
        return;
      }
      const initial: Record<string, Record<string, string>> = {};
      for (const inv of invoices) {
        initial[inv.invoice_id] = { ...(inv.ai_suggestions || {}) };
      }
      setOverridesByInvoice(initial);
      setPreviewInvoices(invoices);
    } finally {
      setLoading(false);
    }
  };

  const executeRun = async (
    overrides: Record<string, Record<string, string>>
  ) => {
    setLoading(true);
    const body = { ...runPayload, overrides_by_invoice: overrides };
    const response = await fetch("/api/reminders/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    setLoading(false);
    setPreviewInvoices(null);

    if (!response.ok) {
      addToast({
        title: "Reminder run failed",
        description: data.error || "Please try again.",
        variant: "error"
      });
      return;
    }
    const skippedMsg =
      data.skipped != null && data.skipped > 0
        ? ` ${data.skipped} skipped (missing placeholders).`
        : "";
    addToast({
      title: "Reminders processed",
      description: `Sent ${data.sent} reminders. ${data.failed} failed.${skippedMsg}`,
      variant: data.failed > 0 ? "info" : "success"
    });
    router.refresh();
  };

  const submitFillAndRun = () => {
    const overrides: Record<string, Record<string, string>> = {};
    for (const [invId, values] of Object.entries(overridesByInvoice)) {
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v != null && String(v).trim() !== "") filtered[k] = String(v).trim();
      }
      if (Object.keys(filtered).length > 0) overrides[invId] = filtered;
    }
    executeRun(overrides);
  };

  const skipFillAndRun = () => {
    executeRun({});
  };

  const acceptAllForInvoice = (invoiceId: string) => {
    const inv = previewInvoices?.find((i) => i.invoice_id === invoiceId);
    if (!inv?.ai_suggestions) return;
    setOverridesByInvoice((prev) => ({
      ...prev,
      [invoiceId]: { ...(prev[invoiceId] ?? {}), ...inv.ai_suggestions }
    }));
  };

  const setOverride = (invoiceId: string, token: string, value: string) => {
    setOverridesByInvoice((prev) => {
      const next = { ...prev };
      next[invoiceId] = { ...(next[invoiceId] ?? {}), [token]: value };
      return next;
    });
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
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Select a variant to use for every reminder in this run. You can edit
            it and add tokens (type <code className="rounded bg-slate-100 px-1">{`{{`}</code> for
            suggestions).
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
                <p className="mt-2 text-xs text-slate-500 line-clamp-4">
                  {variant.body}
                </p>
              </button>
            ))}
          </div>
          {selected !== null && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">
                Edit variant {selected + 1}
              </p>
              <TokenTemplateFields
                subject={variants[selected].subject}
                body={variants[selected].body}
                onSubjectChange={(s) =>
                  setVariants((prev) => {
                    const next = [...prev];
                    next[selected] = { ...next[selected], subject: s };
                    return next;
                  })
                }
                onBodyChange={(b) =>
                  setVariants((prev) => {
                    const next = [...prev];
                    next[selected] = { ...next[selected], body: b };
                    return next;
                  })
                }
                subjectLabel="Subject"
                bodyLabel="Body"
                bodyRows={6}
              />
            </div>
          )}
        </div>
      )}

      {previewInvoices != null && previewInvoices.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-800">
            Fill placeholders for these invoices
          </p>
          <p className="text-xs text-slate-600">
            These reminders use custom placeholders that need a value per invoice. Fill
            them below or accept AI suggestions, then send.
          </p>
          <div className="space-y-4">
            {previewInvoices.map((inv) => (
              <div
                key={inv.invoice_id}
                className="rounded-lg border border-slate-200 bg-white p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {inv.invoice_number} · {inv.client_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => acceptAllForInvoice(inv.invoice_id)}
                    className="text-xs text-slate-600 hover:text-slate-900 underline"
                  >
                    Accept all AI suggestions
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {inv.missing_tokens.map((token) => (
                    <label key={token} className="flex flex-col gap-1">
                      <span className="text-xs text-slate-500">{token}</span>
                      <input
                        type="text"
                        value={overridesByInvoice[inv.invoice_id]?.[token] ?? ""}
                        onChange={(e) =>
                          setOverride(inv.invoice_id, token, e.target.value)
                        }
                        placeholder={inv.ai_suggestions?.[token] ?? ""}
                        className="input text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={submitFillAndRun}
              disabled={loading}
              className="button"
            >
              {loading ? "Sending..." : "Send reminders"}
            </button>
            <button
              type="button"
              onClick={skipFillAndRun}
              disabled={loading}
              className="button-secondary"
            >
              Skip and run without filling
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
