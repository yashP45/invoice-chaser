"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

type ClientOption = {
  id: string;
  name: string;
  email: string;
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" }
];

type LineItem = {
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
};

export function InvoiceCreateForm({ clients }: { clients: ClientOption[] }) {
  const { addToast } = useToast();
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState("");
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
  const [aiMeta, setAiMeta] = useState<{
    ai_extracted: boolean;
    ai_confidence: number | null;
    source_file_path: string | null;
    subtotal: string;
    tax: string;
    total: string;
    payment_terms: string;
    bill_to_address: string;
  }>({
    ai_extracted: false,
    ai_confidence: null,
    source_file_path: null,
    subtotal: "",
    tax: "",
    total: "",
    payment_terms: "",
    bill_to_address: ""
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "", unit_price: "", line_total: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  const clientMap = useMemo(() => {
    return new Map(clients.map((client) => [client.id, client]));
  }, [clients]);

  const clientByEmail = useMemo(() => {
    return new Map(clients.map((client) => [client.email.toLowerCase(), client]));
  }, [clients]);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleClientSelect = (value: string) => {
    setSelectedClientId(value);
    if (!value) {
      setForm((prev) => ({
        ...prev,
        client_name: "",
        client_email: ""
      }));
      return;
    }

    const client = clientMap.get(value);
    if (client) {
      setForm((prev) => ({
        ...prev,
        client_name: client.name,
        client_email: client.email
      }));
    }
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

      if (!selectedClientId) {
        setForm((prev) => ({
          ...prev,
          client_name: data.client_name || prev.client_name,
          client_email: data.client_email || prev.client_email,
          invoice_number: data.invoice_number || prev.invoice_number,
          currency: data.currency || prev.currency,
          issue_date: data.invoice_date || prev.issue_date,
          due_date: data.due_date || prev.due_date,
          amount: data.total ? String(data.total) : prev.amount
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          invoice_number: data.invoice_number || prev.invoice_number,
          amount: data.total ? String(data.total) : prev.amount,
          currency: data.currency || prev.currency,
          issue_date: data.invoice_date || prev.issue_date,
          due_date: data.due_date || prev.due_date
        }));
      }

      if (data.client_email) {
        const match = clientByEmail.get(String(data.client_email).toLowerCase());
        if (match) {
          setSelectedClientId(match.id);
          setForm((prev) => ({
            ...prev,
            client_name: match.name,
            client_email: match.email
          }));
        }
      }

      setAiMeta({
        ai_extracted: Boolean(data.ai_extracted),
        ai_confidence: data.ai_confidence ?? null,
        source_file_path: data.file_path || null,
        subtotal: data.subtotal ? String(data.subtotal) : "",
        tax: data.tax ? String(data.tax) : "",
        total: data.total ? String(data.total) : "",
        payment_terms: data.payment_terms || "",
        bill_to_address: data.client_address || ""
      });

      if (Array.isArray(data.line_items) && data.line_items.length > 0) {
        setLineItems(
          data.line_items.map((item: any) => ({
            description: item.description || "",
            quantity: item.quantity ? String(item.quantity) : "",
            unit_price: item.unit_price ? String(item.unit_price) : "",
            line_total: item.line_total ? String(item.line_total) : ""
          }))
        );
      }

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
      client_id: selectedClientId || undefined,
      ...form,
      amount: Number(form.amount),
      subtotal: aiMeta.subtotal ? Number(aiMeta.subtotal) : undefined,
      tax: aiMeta.tax ? Number(aiMeta.tax) : undefined,
      total: aiMeta.total ? Number(aiMeta.total) : undefined,
      payment_terms: aiMeta.payment_terms || undefined,
      bill_to_address: aiMeta.bill_to_address || undefined,
        ai_extracted: aiMeta.ai_extracted,
        ai_confidence: aiMeta.ai_confidence ?? undefined,
        extracted_at: aiMeta.ai_extracted ? new Date().toISOString() : undefined,
        source_file_path: aiMeta.source_file_path || undefined,
        line_items: lineItems
        .filter((item) => item.description.trim().length > 0)
        .map((item) => ({
          description: item.description,
          quantity: item.quantity ? Number(item.quantity) : undefined,
          unit_price: item.unit_price ? Number(item.unit_price) : undefined,
          line_total: item.line_total ? Number(item.line_total) : undefined
        }))
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
      router.push("/invoices");
      router.refresh();
      return;
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
          Auto-fill from PDF or image
        </label>
        <input
          id="invoice-pdf"
          className="input mt-1"
          type="file"
          accept="application/pdf,image/*"
          onChange={handlePdfParse}
          disabled={parsing}
        />
        {parsing && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Extracting invoice data…
          </div>
        )}
        {aiMeta.ai_extracted && (
          <p className="mt-2 text-xs text-emerald-600">
            AI extraction confidence: {Math.round((aiMeta.ai_confidence || 0) * 100)}%
          </p>
        )}
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="client_select">
            Client master
          </label>
          <select
            id="client_select"
            className="input mt-1"
            value={selectedClientId}
            onChange={(event) => handleClientSelect(event.target.value)}
          >
            <option value="">Add new client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} — {client.email}
              </option>
            ))}
          </select>
          {selectedClientId ? (
            <p className="mt-1 text-xs text-slate-500">
              Using an existing client. Update details in Clients.
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Choose an existing client to avoid duplicates.
            </p>
          )}
        </div>

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
              disabled={Boolean(selectedClientId)}
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
              disabled={Boolean(selectedClientId)}
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

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="subtotal">
              Subtotal
            </label>
            <input
              id="subtotal"
              className="input mt-1"
              value={aiMeta.subtotal}
              onChange={(event) =>
                setAiMeta((prev) => ({ ...prev, subtotal: event.target.value }))
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="tax">
              Tax
            </label>
            <input
              id="tax"
              className="input mt-1"
              value={aiMeta.tax}
              onChange={(event) => setAiMeta((prev) => ({ ...prev, tax: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="total">
              Total
            </label>
            <input
              id="total"
              className="input mt-1"
              value={aiMeta.total}
              onChange={(event) => setAiMeta((prev) => ({ ...prev, total: event.target.value }))}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="payment_terms">
              Payment terms
            </label>
            <input
              id="payment_terms"
              className="input mt-1"
              value={aiMeta.payment_terms}
              onChange={(event) =>
                setAiMeta((prev) => ({ ...prev, payment_terms: event.target.value }))
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="bill_to_address">
              Bill-to address
            </label>
            <input
              id="bill_to_address"
              className="input mt-1"
              value={aiMeta.bill_to_address}
              onChange={(event) =>
                setAiMeta((prev) => ({ ...prev, bill_to_address: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="label">Line items</label>
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                setLineItems((prev) => [
                  ...prev,
                  { description: "", quantity: "", unit_price: "", line_total: "" }
                ])
              }
            >
              Add item
            </button>
          </div>
          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <input
                  className="input"
                  placeholder="Description"
                  value={item.description}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLineItems((prev) =>
                      prev.map((row, idx) =>
                        idx === index ? { ...row, description: value } : row
                      )
                    );
                  }}
                />
                <input
                  className="input"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLineItems((prev) =>
                      prev.map((row, idx) =>
                        idx === index ? { ...row, quantity: value } : row
                      )
                    );
                  }}
                />
                <input
                  className="input"
                  placeholder="Unit price"
                  value={item.unit_price}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLineItems((prev) =>
                      prev.map((row, idx) =>
                        idx === index ? { ...row, unit_price: value } : row
                      )
                    );
                  }}
                />
                <input
                  className="input"
                  placeholder="Line total"
                  value={item.line_total}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLineItems((prev) =>
                      prev.map((row, idx) =>
                        idx === index ? { ...row, line_total: value } : row
                      )
                    );
                  }}
                />
                <button
                  type="button"
                  className="button-danger"
                  onClick={() =>
                    setLineItems((prev) => prev.filter((_, idx) => idx !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
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

        <button className="button" type="submit" disabled={loading || parsing}>
          {loading ? "Saving..." : parsing ? "Parsing..." : "Save invoice"}
        </button>
      </form>
    </div>
  );
}
