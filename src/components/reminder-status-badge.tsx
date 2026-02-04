type ReminderStatus = "queued" | "sent" | "failed";

const STATUS_STYLES: Record<ReminderStatus, string> = {
  queued: "border-slate-200 bg-slate-50 text-slate-600",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700"
};

export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
        STATUS_STYLES[status]
      }`}
    >
      {status}
    </span>
  );
}
