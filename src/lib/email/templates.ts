export const DEFAULT_SUBJECT =
  "Friendly reminder: Invoice {{invoice_number}} is {{days_overdue}} days past due";

export const DEFAULT_BODY = `Hi {{client_name}},\n\nThis is a friendly reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}} and is now {{days_overdue}} days past due.\n\nIf you've already sent payment, please disregard this note. Otherwise, could you let us know when we can expect payment?\n\nThanks,\n{{sender_name}}\n{{company_name}}`;

export const BUILTIN_FIELDS = [
  {
    key: "client_name",
    label: "Client Name",
    description: "The name of the client"
  },
  {
    key: "invoice_number",
    label: "Invoice Number",
    description: "The invoice number"
  },
  {
    key: "amount",
    label: "Amount",
    description: "The invoice amount with currency"
  },
  {
    key: "due_date",
    label: "Due Date",
    description: "The invoice due date"
  },
  {
    key: "days_overdue",
    label: "Days Overdue",
    description: "Number of days the invoice is overdue"
  },
  {
    key: "sender_name",
    label: "Sender Name",
    description: "The name of the person sending the reminder"
  },
  {
    key: "company_name",
    label: "Company Name",
    description: "Your company name"
  }
] as const;

export const BUILTIN_TOKEN_KEYS = BUILTIN_FIELDS.map((field) => field.key);

/**
 * Suggested custom tokens: not built-in, but AI will try to read them from the invoice
 * (e.g. line items, payment terms, references). Users can also type any {{placeholder}}.
 */
export const SUGGESTED_CUSTOM_FIELDS = [
  { key: "project_name", label: "Project Name", description: "Read from invoice (AI)" },
  { key: "po_number", label: "PO Number", description: "Read from invoice (AI)" },
  { key: "reference", label: "Reference", description: "Read from invoice (AI)" },
  { key: "contract_id", label: "Contract ID", description: "Read from invoice (AI)" },
  { key: "first_line_item", label: "First line item", description: "Read from invoice (AI)" },
  { key: "service_description", label: "Service description", description: "Read from invoice (AI)" },
  { key: "billing_period", label: "Billing period", description: "Read from invoice (AI)" }
] as const;

import { normalizeTokenKey } from "./template-schema";

const TOKEN_REGEX = /\{\{\s*([^}]+)\s*\}\}/g;

/**
 * Replaces all {{ ... }} by normalized key lookup in data.
 * Both {{project_name}} and {{Project Name}} resolve to data["project_name"].
 */
export function renderTemplate(template: string, data: Record<string, string | number>): string {
  return template.replace(TOKEN_REGEX, (_, raw) => {
    const key = normalizeTokenKey(raw);
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : "";
  });
}
