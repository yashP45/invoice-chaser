"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { TokenTemplateFields } from "@/components/token-template-fields";

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

type Variant = { subject: string; body: string };

export function SendReminderButton({ invoiceId, disabled, className, label }: Props) {
  const { addToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [needsInput, setNeedsInput] = useState<NeedsInputState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [aiVariants, setAiVariants] = useState<Variant[] | null>(null);
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<
    { subject: string; body: string } | null
  >(null);

  const handleSend = async (
    tokenOverrides?: Record<string, string>,
    subjectTemplate?: string,
    bodyTemplate?: string
  ) => {
    if (disabled || loading) return;
    setLoading(true);
    setNeedsInput(null);
    setChoiceModalOpen(false);
    setAiVariants(null);
    setSelectedVariantIndex(null);
    if (subjectTemplate != null && bodyTemplate != null) {
      setPendingTemplate({ subject: subjectTemplate, body: bodyTemplate });
    } else {
      setPendingTemplate(null);
    }
    try {
      const payload: Record<string, unknown> = { invoice_id: invoiceId };
      if (tokenOverrides && Object.keys(tokenOverrides).length > 0) {
        payload.token_overrides = tokenOverrides;
      }
      const sub = subjectTemplate ?? pendingTemplate?.subject;
      const bod = bodyTemplate ?? pendingTemplate?.body;
      if (sub) payload.subject_template = sub;
      if (bod) payload.body_template = bod;
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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

      setPendingTemplate(null);

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
      setPendingTemplate(null);
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
      const payload: Record<string, unknown> = {
        invoice_id: invoiceId,
        token_overrides: trimmed
      };
      if (pendingTemplate) {
        payload.subject_template = pendingTemplate.subject;
        payload.body_template = pendingTemplate.body;
      }
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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

  const openChoiceModal = () => {
    if (disabled || loading) return;
    setChoiceModalOpen(true);
    setAiVariants(null);
    setSelectedVariantIndex(null);
  };

  const generateAiVariants = async () => {
    setGeneratingVariants(true);
    try {
      const res = await fetch("/api/reminders/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate variants");
      setAiVariants(data.variants || []);
      setSelectedVariantIndex(0);
    } catch (err) {
      addToast({
        title: "AI variants failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setGeneratingVariants(false);
    }
  };

  const sendWithSelectedVariant = () => {
    if (aiVariants == null || selectedVariantIndex == null) return;
    const v = aiVariants[selectedVariantIndex];
    if (!v) return;
    handleSend(undefined, v.subject, v.body);
  };

  useEffect(() => {
    if (choiceModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [choiceModalOpen]);

  return (
    <>
      <button
        className={className || "button-secondary"}
        type="button"
        onClick={openChoiceModal}
        disabled={loading || disabled}
      >
        {loading ? "Sending..." : label || "Send reminder"}
      </button>

      {choiceModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setChoiceModalOpen(false);
              setAiVariants(null);
              setSelectedVariantIndex(null);
            }
          }}
        >
          <div className="card w-full max-w-lg p-6 my-auto flex flex-col max-h-[90vh] relative z-[101] !bg-white shadow-2xl" style={{ backdropFilter: "none" }}>
            {aiVariants == null ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900">
                  Send reminder
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Send with your default template or generate AI variants for this
                  invoice.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    className="button w-full"
                    onClick={() => {
                      setChoiceModalOpen(false);
                      handleSend();
                    }}
                    disabled={loading}
                  >
                    Send with default template
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full"
                    onClick={generateAiVariants}
                    disabled={generatingVariants}
                  >
                    {generatingVariants ? "Generating..." : "Generate AI variants"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary w-full"
                    onClick={() => setChoiceModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900 shrink-0">
                  Choose or edit a variant
                </h2>
                <p className="mt-1 text-sm text-slate-600 shrink-0">
                  Edit subject/body and add tokens (type {`{{`} for suggestions).
                  Then send with your chosen variant.
                </p>
                <div className="mt-4 space-y-4 overflow-y-auto min-h-0 flex-1 pr-1">
                  {aiVariants.map((variant, index) => (
                    <div
                      key={index}
                      className={`rounded-xl border p-4 ${
                        selectedVariantIndex === index
                          ? "border-slate-900 bg-slate-50/80"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-700">
                          Variant {index + 1}
                        </span>
                        <button
                          type="button"
                          className="button-secondary text-xs"
                          onClick={() => setSelectedVariantIndex(index)}
                        >
                          {selectedVariantIndex === index ? "Selected" : "Use this"}
                        </button>
                      </div>
                      <div className="mt-3">
                        <TokenTemplateFields
                          subject={variant.subject}
                          body={variant.body}
                          onSubjectChange={(s) =>
                            setAiVariants((prev) => {
                              if (!prev) return prev;
                              const next = [...prev];
                              next[index] = { ...next[index], subject: s };
                              return next;
                            })
                          }
                          onBodyChange={(b) =>
                            setAiVariants((prev) => {
                              if (!prev) return prev;
                              const next = [...prev];
                              next[index] = { ...next[index], body: b };
                              return next;
                            })
                          }
                          subjectLabel="Subject"
                          bodyLabel="Body"
                          bodyRows={3}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    className="button"
                    onClick={sendWithSelectedVariant}
                    disabled={loading || selectedVariantIndex == null}
                  >
                    {loading ? "Sending..." : "Send with selected variant"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setAiVariants(null);
                      setSelectedVariantIndex(null);
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setChoiceModalOpen(false);
                      setAiVariants(null);
                      setSelectedVariantIndex(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {needsInput && needsInput.missing_tokens.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6 !bg-white shadow-2xl" style={{ backdropFilter: "none" }}>
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
