type Status = "open" | "partial" | "paid" | "void";

const STATUS_STYLES: Record<Status, string> = {
  open: "border-amber-200 bg-amber-50 text-amber-700",
  partial: "border-sky-200 bg-sky-50 text-sky-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  void: "border-slate-200 bg-slate-50 text-slate-500"
};

export function StatusBadge({ status }: { status: Status }) {
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
