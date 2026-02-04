"use client";

import { useFormStatus } from "react-dom";

type Props = {
  formAction: (formData: FormData) => void;
  confirmText: string;
  className?: string;
  children: React.ReactNode;
};

export function ConfirmButton({ formAction, confirmText, className, children }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
      disabled={pending}
    >
      {pending ? "Working..." : children}
    </button>
  );
}
