"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InvoiceOption = {
  id: string;
  invoice_number: string;
  client_name?: string | null;
};

export function ReminderVariantPicker({ invoices }: { invoices: InvoiceOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(invoices[0]?.id || "");

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Choose an invoice</h3>
        <p className="text-xs text-slate-500">
          Pick an invoice to generate AI reminder variants.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[2fr_auto]">
        <select
          className="input"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {invoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.invoice_number}
              {invoice.client_name ? ` — ${invoice.client_name}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button-secondary"
          onClick={() => selected && router.push(`/reminders/variants?invoice=${selected}`)}
          disabled={!selected}
        >
          Open variants
        </button>
      </div>
    </div>
  );
}
