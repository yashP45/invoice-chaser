"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

export function ImportForm() {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const response = await fetch("/api/import", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      addToast({
        title: "Import failed",
        description: data.error || "Please check your CSV format.",
        variant: "error"
      });
    } else {
      addToast({
        title: "CSV imported",
        description: `Imported ${data.inserted} invoices. ${data.skipped} skipped.`,
        variant: "success"
      });
      formElement.reset();
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <form className="card p-4 space-y-3" onSubmit={handleSubmit}>
      <div>
        <p className="text-sm font-semibold text-slate-700">Upload CSV</p>
        <p className="text-xs text-slate-500">
          We auto-map common exports (QuickBooks, Xero). Required: invoice, client, email,
          amount, due date. Optional: subtotal, tax, total, payment_terms,
          bill_to_address. Line items: item1_desc/item1_qty/item1_unit_price/item1_line_total
          up to item5_*. For PDFs/images, use the manual form on Invoices.
        </p>
      </div>
      <div>
        <label className="sr-only" htmlFor="csv-file">
          CSV file
        </label>
        <input
          id="csv-file"
          className="input mt-1"
          type="file"
          name="file"
          accept=".csv"
          required
          disabled={loading}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a
          className="button-secondary"
          href="/templates/invoice_template.csv"
          download
        >
          Download CSV template
        </a>
        <p className="text-xs text-slate-500">
          Includes line item columns (up to 5) and optional totals.
        </p>
      </div>
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Importing..." : "Import CSV"}
      </button>
    </form>
  );
}
