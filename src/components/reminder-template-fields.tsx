"use client";

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { listTokens } from "@/lib/email/template-schema";
import { BUILTIN_FIELDS, BUILTIN_TOKEN_KEYS, SUGGESTED_CUSTOM_FIELDS, renderTemplate } from "@/lib/email/templates";
import type { ReactNode } from "react";

export type ReminderTemplateFieldsRef = {
  getSubject: () => string;
  getBody: () => string;
};

type Props = {
  defaultSubject: string;
  defaultBody: string;
  companyName?: string;
  senderName?: string;
};

type AutocompleteField = "subject" | "body" | null;

const AUTCOMPLETE_TRIGGER = "{{";
const PREVIEW_DEBOUNCE_MS = 500;

const SAMPLE_BUILTIN: Record<string, string | number> = {
  client_name: "Bluehill Media",
  invoice_number: "INV-2401",
  amount: "USD 1,250.00",
  due_date: "Jan 15, 2026",
  days_overdue: 14,
  sender_name: "Accounts",
  company_name: "Your Company"
};

function highlightLowConfidence(
  text: string,
  tokenConfidence: Record<string, number>,
  tokenValues: Record<string, string>
): ReactNode[] {
  const low = Object.entries(tokenConfidence)
    .filter(([, c]) => c > 0 && c < 0.7)
    .map(([k]) => ({ k, v: tokenValues[k] }))
    .filter(({ v }) => v && v.length > 0);
  if (low.length === 0) return [text];
  const segments: { start: number; end: number; value: string }[] = [];
  for (const { v } of low) {
    const i = text.indexOf(v);
    if (i !== -1) segments.push({ start: i, end: i + v.length, value: v });
  }
  segments.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number; value: string }[] = [];
  for (const s of segments) {
    if (merged.length && s.start < merged[merged.length - 1].end) continue;
    merged.push(s);
  }
  const out: ReactNode[] = [];
  let last = 0;
  for (const { start, end, value } of merged) {
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <span
        key={`${start}-${end}`}
        className="bg-amber-100/80 rounded px-0.5"
        title="AI guess — may be overridden at send time"
      >
        {value}
      </span>
    );
    last = end;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export const ReminderTemplateFields = forwardRef<ReminderTemplateFieldsRef, Props>(function ReminderTemplateFields(
  { defaultSubject, defaultBody, companyName, senderName },
  ref
) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  useImperativeHandle(ref, () => ({
    getSubject: () => subject,
    getBody: () => body
  }));
  const [autocompleteOpen, setAutocompleteOpen] = useState<AutocompleteField>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [previewSubject, setPreviewSubject] = useState(defaultSubject);
  const [previewBody, setPreviewBody] = useState(defaultBody);
  const [tokenConfidence, setTokenConfidence] = useState<Record<string, number>>({});
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSubject(defaultSubject);
    setBody(defaultBody);
  }, [defaultSubject, defaultBody]);

  useEffect(() => {
    const builtin = { ...SAMPLE_BUILTIN };
    if (companyName) builtin.company_name = companyName;
    if (senderName) builtin.sender_name = senderName;
    setPreviewSubject(renderTemplate(defaultSubject, builtin));
    setPreviewBody(renderTemplate(defaultBody, builtin));
  }, [defaultSubject, defaultBody, companyName, senderName]);

  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      previewTimerRef.current = null;
      const payload: Record<string, string> = { subject, body };
      if (companyName) payload.company_name = companyName;
      if (senderName) payload.sender_name = senderName;
      setPreviewLoading(true);
      fetch("/api/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Preview failed"))))
        .then((data) => {
          setPreviewSubject(data.preview_subject ?? subject);
          setPreviewBody(data.preview_body ?? body);
          setTokenConfidence(data.token_confidence ?? {});
          setTokenValues(data.token_values ?? {});
        })
        .catch(() => {
          const builtin = { ...SAMPLE_BUILTIN };
          if (companyName) builtin.company_name = companyName;
          if (senderName) builtin.sender_name = senderName;
          setPreviewSubject(renderTemplate(subject, builtin));
          setPreviewBody(renderTemplate(body, builtin));
          setTokenConfidence({});
          setTokenValues({});
        })
        .finally(() => setPreviewLoading(false));
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [subject, body, companyName, senderName]);

  const { builtin, custom } = listTokens(subject, body, BUILTIN_TOKEN_KEYS);
  const builtinList = builtin.map((k) => `{{${k}}}`).join(", ");
  const customList = custom.map((k) => `{{${k}}}`).join(", ");

  const builtinOptions = BUILTIN_FIELDS.map((f) => ({
    key: f.key,
    label: f.key.replace(/_/g, " "),
    description: f.description,
    isCustom: false
  }));
  const suggestedCustomOptions = SUGGESTED_CUSTOM_FIELDS.map((f) => ({
    key: f.key,
    label: f.key.replace(/_/g, " "),
    description: f.description,
    isCustom: true
  }));
  const suggestedKeys = new Set<string>(SUGGESTED_CUSTOM_FIELDS.map((f) => f.key));
  const customOptions = custom
    .filter((k) => !suggestedKeys.has(k))
    .map((k) => ({
      key: k,
      label: k.replace(/_/g, " "),
      description: "Read from invoice (AI)",
      isCustom: true
    }));
  const autocompleteOptions = [...builtinOptions, ...suggestedCustomOptions, ...customOptions];

  const checkTrigger = useCallback(
    (value: string, field: AutocompleteField) => {
      if (value.endsWith(AUTCOMPLETE_TRIGGER)) {
        setAutocompleteOpen(field);
        setHighlightIndex(0);
      } else {
        setAutocompleteOpen(null);
      }
    },
    []
  );

  const insertToken = useCallback(
    (key: string) => {
      const token = `{{${key}}}`;
      if (autocompleteOpen === "subject") {
        setSubject((prev) => (prev.endsWith(AUTCOMPLETE_TRIGGER) ? prev.slice(0, -2) + token : prev));
        subjectRef.current?.focus();
      } else if (autocompleteOpen === "body") {
        setBody((prev) => (prev.endsWith(AUTCOMPLETE_TRIGGER) ? prev.slice(0, -2) + token : prev));
        bodyRef.current?.focus();
      }
      setAutocompleteOpen(null);
    },
    [autocompleteOpen]
  );

  useEffect(() => {
    if (!autocompleteOpen || autocompleteOptions.length === 0) return;
    const el = listRef.current;
    if (!el) return;
    const item = el.children[highlightIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [autocompleteOpen, highlightIndex, autocompleteOptions.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, field: AutocompleteField) => {
      if (autocompleteOpen !== field || autocompleteOptions.length === 0) return;
      if (e.key === "Escape") {
        setAutocompleteOpen(null);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % autocompleteOptions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + autocompleteOptions.length) % autocompleteOptions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertToken(autocompleteOptions[highlightIndex].key);
      }
    },
    [autocompleteOpen, autocompleteOptions, highlightIndex, insertToken]
  );

  const showAutocompleteSubject = autocompleteOpen === "subject" && autocompleteOptions.length > 0;
  const showAutocompleteBody = autocompleteOpen === "body" && autocompleteOptions.length > 0;

  return (
    <>
      <input type="hidden" name="reminder_subject" value={subject} readOnly />
      <input type="hidden" name="reminder_body" value={body} readOnly />
      <div className="relative">
        <label className="label" htmlFor="reminder_subject">
          Reminder subject
        </label>
        <input
          ref={subjectRef}
          id="reminder_subject"
          className="input mt-1"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            checkTrigger(e.target.value, "subject");
          }}
          onKeyDown={(e) => handleKeyDown(e, "subject")}
          aria-label="Reminder subject"
        />
        {showAutocompleteSubject && (
          <div
            ref={listRef}
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {autocompleteOptions.map((opt, i) => (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={i === highlightIndex}
                className={`w-full px-3 py-2 text-left text-sm ${
                  i === highlightIndex ? "bg-slate-100" : ""
                } hover:bg-slate-50`}
                onClick={() => insertToken(opt.key)}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <span className="font-medium">{`{{${opt.key}}}`}</span>
                <span className="ml-2 text-slate-500">{opt.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <label className="label" htmlFor="reminder_body">
          Reminder body
        </label>
        <textarea
          ref={bodyRef}
          id="reminder_body"
          className="input mt-1 min-h-[220px]"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            checkTrigger(e.target.value, "body");
          }}
          onKeyDown={(e) => handleKeyDown(e, "body")}
          aria-label="Reminder body"
        />
        {showAutocompleteBody && (
          <div
            ref={listRef}
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {autocompleteOptions.map((opt, i) => (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={i === highlightIndex}
                className={`w-full px-3 py-2 text-left text-sm ${
                  i === highlightIndex ? "bg-slate-100" : ""
                } hover:bg-slate-50`}
                onClick={() => insertToken(opt.key)}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <span className="font-medium">{`{{${opt.key}}}`}</span>
                <span className="ml-2 text-slate-500">{opt.description}</span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Use <code className="rounded bg-slate-100 px-1">{`{{any_placeholder}}`}</code> in your text;
          type <code className="rounded bg-slate-100 px-1">{`{{`}</code> for suggestions.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Built-in (always filled): {builtinList || "—"}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          <strong>Tokens in your template:</strong>{" "}
          {custom.length > 0 ? (
            <>Custom: {customList}. These will be filled by AI or you when sending.</>
          ) : (
            <>
              No custom tokens yet. Type e.g. {`{{project_name}}`} or {`{{PO number}}`} to add one.
            </>
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Preview {previewLoading ? "(updating…)" : ""}
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-700">{previewSubject}</p>
        <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
          {highlightLowConfidence(previewBody, tokenConfidence, tokenValues)}
        </pre>
      </div>
    </>
  );
});
