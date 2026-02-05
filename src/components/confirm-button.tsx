"use client";

import { useState } from "react";
import { LoadingButton } from "@/components/loading-button";

type Props = {
  formAction: (formData: FormData) => void;
  confirmText: string;
  className?: string;
  children: React.ReactNode;
};

export function ConfirmButton({ formAction, confirmText, className, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Confirm action</h2>
              <p className="text-sm text-slate-600">{confirmText}</p>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <LoadingButton
                className="button-danger"
                formAction={formAction}
                pendingText="Deleting..."
              >
                Confirm
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
