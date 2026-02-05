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

export function SendReminderButton({ invoiceId, disabled, className, label }: Props) {
  const { addToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send reminder.");
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

  return (
    <button
      className={className || "button-secondary"}
      type="button"
      onClick={handleSend}
      disabled={loading || disabled}
    >
      {loading ? "Sending..." : label || "Send reminder"}
    </button>
  );
}
