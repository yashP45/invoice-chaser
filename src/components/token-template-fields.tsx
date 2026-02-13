"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { listTokens } from "@/lib/email/template-schema";
import {
  BUILTIN_FIELDS,
  BUILTIN_TOKEN_KEYS,
  SUGGESTED_CUSTOM_FIELDS
} from "@/lib/email/templates";

type AutocompleteField = "subject" | "body" | null;

const AUTCOMPLETE_TRIGGER = "{{";

export type TokenTemplateFieldsProps = {
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  subjectLabel?: string;
  bodyLabel?: string;
  bodyRows?: number;
  className?: string;
};

export function TokenTemplateFields({
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  subjectLabel = "Subject",
  bodyLabel = "Body",
  bodyRows = 4,
  className = ""
}: TokenTemplateFieldsProps) {
  const [autocompleteOpen, setAutocompleteOpen] = useState<AutocompleteField>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { custom } = listTokens(subject, body, BUILTIN_TOKEN_KEYS);
  const suggestedKeys = new Set<string>(SUGGESTED_CUSTOM_FIELDS.map((f) => f.key));
  const customOptions = custom
    .filter((k) => !suggestedKeys.has(k))
    .map((k) => ({
      key: k,
      label: k.replace(/_/g, " "),
      description: "Read from invoice (AI)",
      isCustom: true
    }));
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
  const autocompleteOptions = [
    ...builtinOptions,
    ...suggestedCustomOptions,
    ...customOptions
  ];

  const checkTrigger = useCallback((value: string, field: AutocompleteField) => {
    if (value.endsWith(AUTCOMPLETE_TRIGGER)) {
      setAutocompleteOpen(field);
      setHighlightIndex(0);
    } else {
      setAutocompleteOpen(null);
    }
  }, []);

  const insertToken = useCallback(
    (key: string, field: AutocompleteField) => {
      const token = `{{${key}}}`;
      if (field === "subject") {
        const next = subject.endsWith(AUTCOMPLETE_TRIGGER)
          ? subject.slice(0, -2) + token
          : subject + token;
        onSubjectChange(next);
        subjectRef.current?.focus();
      } else {
        const next = body.endsWith(AUTCOMPLETE_TRIGGER)
          ? body.slice(0, -2) + token
          : body + token;
        onBodyChange(next);
        bodyRef.current?.focus();
      }
      setAutocompleteOpen(null);
    },
    [subject, body, onSubjectChange, onBodyChange]
  );

  useEffect(() => {
    if (!autocompleteOpen || autocompleteOptions.length === 0) return;
    const item = listRef.current?.children[highlightIndex] as HTMLElement;
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
        setHighlightIndex(
          (i) => (i - 1 + autocompleteOptions.length) % autocompleteOptions.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertToken(autocompleteOptions[highlightIndex].key, field);
      }
    },
    [autocompleteOpen, autocompleteOptions, highlightIndex, insertToken]
  );

  const showSubjectAc = autocompleteOpen === "subject" && autocompleteOptions.length > 0;
  const showBodyAc = autocompleteOpen === "body" && autocompleteOptions.length > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <label className="label" htmlFor="token-subject">
          {subjectLabel}
        </label>
        <input
          ref={subjectRef}
          id="token-subject"
          className="input mt-1"
          value={subject}
          onChange={(e) => {
            onSubjectChange(e.target.value);
            checkTrigger(e.target.value, "subject");
          }}
          onKeyDown={(e) => handleKeyDown(e, "subject")}
        />
        {showSubjectAc && (
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
                onClick={() => insertToken(opt.key, "subject")}
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
        <label className="label" htmlFor="token-body">
          {bodyLabel}
        </label>
        <textarea
          ref={bodyRef}
          id="token-body"
          className="input mt-1 min-h-[120px]"
          rows={bodyRows}
          value={body}
          onChange={(e) => {
            onBodyChange(e.target.value);
            checkTrigger(e.target.value, "body");
          }}
          onKeyDown={(e) => handleKeyDown(e, "body")}
        />
        {showBodyAc && (
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
                onClick={() => insertToken(opt.key, "body")}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <span className="font-medium">{`{{${opt.key}}}`}</span>
                <span className="ml-2 text-slate-500">{opt.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Type <code className="rounded bg-slate-100 px-1">{`{{`}</code> for token
        suggestions.
      </p>
    </div>
  );
}
