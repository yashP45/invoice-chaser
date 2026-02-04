import Papa from "papaparse";
import { z } from "zod";

const HEADER_ALIASES: Record<string, string> = {
  "invoice number": "invoice_number",
  "invoice #": "invoice_number",
  "invoice no": "invoice_number",
  "inv no": "invoice_number",
  "inv #": "invoice_number",
  "invoice": "invoice_number",
  "client": "client_name",
  "client name": "client_name",
  "customer": "client_name",
  "customer name": "client_name",
  "company": "client_name",
  "company name": "client_name",
  "client email": "client_email",
  "customer email": "client_email",
  "email": "client_email",
  "contact email": "client_email",
  "amount": "amount",
  "total": "amount",
  "total amount": "amount",
  "amount due": "amount",
  "balance": "amount",
  "currency": "currency",
  "currency code": "currency",
  "issue date": "issue_date",
  "invoice date": "issue_date",
  "date": "issue_date",
  "due date": "due_date",
  "due": "due_date",
  "status": "status",
  "invoice status": "status"
};

function normalizeHeader(header: string) {
  const cleaned = header.trim().toLowerCase();
  return HEADER_ALIASES[cleaned] || cleaned;
}

const RowSchema = z.object({
  invoice_number: z.string().min(1),
  client_name: z.string().min(1),
  client_email: z.string().email(),
  amount: z.string().min(1),
  currency: z.string().optional(),
  issue_date: z.string().optional(),
  due_date: z.string().min(1),
  status: z.string().optional()
});

export type ParsedRow = z.infer<typeof RowSchema> & {
  normalized: {
    amount: number;
    currency: string;
    issue_date: Date | null;
    due_date: Date;
    status: "open" | "partial" | "paid" | "void";
  };
};

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function normalizeStatus(value?: string) {
  const normalized = value?.toLowerCase().trim();
  if (normalized === "paid") return "paid" as const;
  if (normalized === "settled") return "paid" as const;
  if (normalized === "partial") return "partial" as const;
  if (normalized === "void") return "void" as const;
  return "open" as const;
}

export function parseInvoiceCsv(csvText: string) {
  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader
  });

  if (errors.length) {
    return { rows: [], errors: errors.map((error) => error.message) };
  }

  const rows: ParsedRow[] = [];
  const errorMessages: string[] = [];

  data.forEach((row, index) => {
    const result = RowSchema.safeParse(row);
    if (!result.success) {
      errorMessages.push(`Row ${index + 2}: ${result.error.issues[0]?.message}`);
      return;
    }

    const amount = Number(result.data.amount);
    if (Number.isNaN(amount)) {
      errorMessages.push(`Row ${index + 2}: amount must be a number`);
      return;
    }

    const dueDate = parseDate(result.data.due_date);
    if (!dueDate) {
      errorMessages.push(`Row ${index + 2}: due_date is invalid`);
      return;
    }

    const issueDate = parseDate(result.data.issue_date);

    rows.push({
      ...result.data,
      normalized: {
        amount,
        currency: result.data.currency?.trim() || "USD",
        issue_date: issueDate,
        due_date: dueDate,
        status: normalizeStatus(result.data.status)
      }
    });
  });

  return { rows, errors: errorMessages };
}
