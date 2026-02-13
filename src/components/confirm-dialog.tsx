"use client";

import { useState } from "react";
import { LoadingButton } from "@/components/loading-button";

type Props = {
  title: string;
  description?: string;
  triggerLabel: string;
  confirmLabel?: string;
  cancelLabel?: string;
  triggerClassName?: string;
  formAction: (formData: FormData) => void;
  hiddenFields?: Record<string, string>;
};

export function ConfirmDialog({
  title,
  description,
  triggerLabel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  triggerClassName,
  formAction,
  hiddenFields
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6 !bg-white shadow-2xl" style={{ backdropFilter: "none" }}>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              {description && (
                <p className="text-sm text-slate-600">{description}</p>
              )}
            </div>

            <form action={formAction} className="mt-6 space-y-4">
              {hiddenFields &&
                Object.entries(hiddenFields).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setOpen(false)}
                >
                  {cancelLabel}
                </button>
                <LoadingButton className="button-danger" pendingText="Deleting...">
                  {confirmLabel}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
