"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

type Props = {
  invoiceId: string;
  disabled?: boolean;
  className?: string;
  label?: string;
};

type NeedsInputState = {
  missing_tokens: string[];
  ai_suggestions: Record<string, string | null>;
  token_confidence: Record<string, number>;
  invoice_id: string;
};

export function SendReminderButton({ invoiceId, disabled, className, label }: Props) {
  const { addToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [needsInput, setNeedsInput] = useState<NeedsInputState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const handleSend = async (tokenOverrides?: Record<string, string>) => {
    if (disabled || loading) return;
    setLoading(true);
    setNeedsInput(null);
    try {
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          ...(tokenOverrides && Object.keys(tokenOverrides).length > 0
            ? { token_overrides: tokenOverrides }
            : {})
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send reminder.");
      }

      if (data.needs_input) {
        setNeedsInput({
          missing_tokens: data.missing_tokens || [],
          ai_suggestions: data.ai_suggestions || {},
          token_confidence: data.token_confidence || {},
          invoice_id: data.invoice_id || invoiceId
        });
        setOverrides(
          (data.missing_tokens || []).reduce(
            (acc: Record<string, string>, token: string) => {
              const suggested = data.ai_suggestions?.[token];
              acc[token] = suggested && typeof suggested === "string" ? suggested : "";
              return acc;
            },
            {}
          )
        );
        return;
      }

      if (data.skipped) {
        addToast({
          title: "Reminder skipped",
          description: data.reason || "No reminder sent.",
          variant: "info"
        });
      } else {
        addToast({
          title: "Reminder sent",
          description: "Email sent successfully.",
          variant: "success"
        });
      }
      router.refresh();
    } catch (error) {
      addToast({
        title: "Send failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOverrides = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!needsInput) return;
    const trimmed: Record<string, string> = {};
    needsInput.missing_tokens.forEach((token) => {
      const v = overrides[token];
      trimmed[token] = typeof v === "string" ? v.trim() : "";
    });
    const missing = needsInput.missing_tokens.filter((t) => !trimmed[t]);
    if (missing.length > 0) {
      addToast({
        title: "Fill all placeholders",
        description: "Please provide a value for each placeholder.",
        variant: "error"
      });
      return;
    }
    setLoading(true);
    setNeedsInput(null);
    try {
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, token_overrides: trimmed })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send.");
      if (data.needs_input) {
        setNeedsInput({
          missing_tokens: data.missing_tokens || [],
          ai_suggestions: data.ai_suggestions || {},
          token_confidence: data.token_confidence || {},
          invoice_id: data.invoice_id || invoiceId
        });
        setOverrides(
          (data.missing_tokens || []).reduce(
            (acc: Record<string, string>, token: string) => {
              acc[token] = data.ai_suggestions?.[token] ?? "";
              return acc;
            },
            {}
          )
        );
        return;
      }
      addToast({
        title: "Reminder sent",
        description: "Email sent successfully.",
        variant: "success"
      });
      router.refresh();
    } catch (err) {
      addToast({
        title: "Send failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className={className || "button-secondary"}
        type="button"
        onClick={() => handleSend()}
        disabled={loading || disabled}
      >
        {loading ? "Sending..." : label || "Send reminder"}
      </button>

      {needsInput && needsInput.missing_tokens.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900">Fill in placeholders</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review or edit AI suggestions below, then send. You can accept all or change any value.
            </p>
            <form onSubmit={handleSubmitOverrides} className="mt-4 space-y-4">
              {needsInput.missing_tokens.map((token) => {
                const confidence = needsInput.token_confidence[token] ?? 0;
                const isHigh = confidence >= 0.7;
                const isMedium = confidence >= 0.4 && confidence < 0.7;
                return (
                  <div key={token}>
                    <div className="flex items-center gap-2">
                      <label className="label text-xs" htmlFor={`token-${token}`}>
                        {token.replace(/_/g, " ")}
                      </label>
                      {isHigh && (
                        <span
                          className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800"
                          title="High confidence"
                        >
                          High confidence
                        </span>
                      )}
                      {isMedium && (
                        <span
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800"
                          title="AI guess — please review"
                        >
                          AI guess
                        </span>
                      )}
                      {!isHigh && !isMedium && confidence > 0 && (
                        <span
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                          title="Low confidence"
                        >
                          Low
                        </span>
                      )}
                    </div>
                    <input
                      id={`token-${token}`}
                      type="text"
                      className="input mt-1 w-full"
                      value={overrides[token] ?? ""}
                      onChange={(e) =>
                        setOverrides((prev) => ({ ...prev, [token]: e.target.value }))
                      }
                      placeholder={`Value for ${token}`}
                    />
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setNeedsInput(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    const all: Record<string, string> = {};
                    needsInput.missing_tokens.forEach((t) => {
                      const v = needsInput.ai_suggestions[t];
                      all[t] = v && typeof v === "string" ? v : "";
                    });
                    setOverrides(all);
                  }}
                >
                  Accept all AI suggestions
                </button>
                <button type="submit" className="button" disabled={loading}>
                  {loading ? "Sending..." : "Send reminder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
