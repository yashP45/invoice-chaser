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
          amount, due date. For PDFs/images, use the manual form on Invoices.
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
        />
      </div>
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Importing..." : "Import CSV"}
      </button>
    </form>
  );
}
