"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" }
];

export function InvoiceCreateForm() {
  const { addToast } = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    invoice_number: "",
    amount: "",
    currency: "USD",
    issue_date: "",
    due_date: "",
    status: "open"
  });
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePdfParse = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/invoices/parse", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to parse PDF");
      }

      setForm((prev) => ({
        ...prev,
        ...data,
        amount: data.amount ? String(data.amount) : prev.amount
      }));

      addToast({
        title: "PDF parsed",
        description: "We filled what we could. Please review before saving.",
        variant: "success"
      });
    } catch (error) {
      addToast({
        title: "PDF parsing failed",
        description: error instanceof Error ? error.message : "Try a different file.",
        variant: "error"
      });
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      amount: Number(form.amount)
    };

    try {
      const response = await fetch("/api/invoices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create invoice");
      }

      addToast({
        title: "Invoice saved",
        description: "Invoice added and ready for reminders.",
        variant: "success"
      });
      router.refresh();

      setForm({
        client_name: "",
        client_email: "",
        invoice_number: "",
        amount: "",
        currency: "USD",
        issue_date: "",
        due_date: "",
        status: "open"
      });
    } catch (error) {
      addToast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Add invoice</h3>
        <p className="text-xs text-slate-500">
          Upload a PDF to auto-fill or enter details manually.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="invoice-pdf">
          Auto-fill from PDF
        </label>
        <input
          id="invoice-pdf"
          className="input mt-1"
          type="file"
          accept="application/pdf"
          onChange={handlePdfParse}
          disabled={parsing}
        />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="client_name">
              Client name
            </label>
            <input
              id="client_name"
              className="input mt-1"
              value={form.client_name}
              onChange={(event) => updateField("client_name", event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="client_email">
              Client email
            </label>
            <input
              id="client_email"
              type="email"
              className="input mt-1"
              value={form.client_email}
              onChange={(event) => updateField("client_email", event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="invoice_number">
              Invoice number
            </label>
            <input
              id="invoice_number"
              className="input mt-1"
              value={form.invoice_number}
              onChange={(event) => updateField("invoice_number", event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="amount">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              className="input mt-1"
              value={form.amount}
              onChange={(event) => updateField("amount", event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="currency">
              Currency
            </label>
            <input
              id="currency"
              className="input mt-1"
              value={form.currency}
              onChange={(event) => updateField("currency", event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="issue_date">
              Issue date
            </label>
            <input
              id="issue_date"
              type="date"
              className="input mt-1"
              value={form.issue_date}
              onChange={(event) => updateField("issue_date", event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="due_date">
              Due date
            </label>
            <input
              id="due_date"
              type="date"
              className="input mt-1"
              value={form.due_date}
              onChange={(event) => updateField("due_date", event.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            className="input mt-1"
            value={form.status}
            onChange={(event) => updateField("status", event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button className="button" type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save invoice"}
        </button>
      </form>
    </div>
  );
}
