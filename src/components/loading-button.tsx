"use client";

import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: string;
};

export function LoadingButton({ pendingText = "Working...", children, ...props }: Props) {
  const { pending } = useFormStatus();

  return (
    <button {...props} disabled={pending || props.disabled}>
      {pending ? pendingText : children}
    </button>
  );
}
