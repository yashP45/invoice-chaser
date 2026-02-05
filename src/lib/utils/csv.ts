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
  "total amount": "amount",
  "amount due": "amount",
  "balance": "amount",
  "currency": "currency",
  "currency code": "currency",
  "subtotal": "subtotal",
  "tax": "tax",
  "total": "total",
  "payment terms": "payment_terms",
  "payment_term": "payment_terms",
  "bill to address": "bill_to_address",
  "billing address": "bill_to_address",
  "issue date": "issue_date",
  "invoice date": "issue_date",
  "date": "issue_date",
  "due date": "due_date",
  "due": "due_date",
  "status": "status",
  "invoice status": "status",
  "item1_desc": "item1_desc",
  "item1_qty": "item1_qty",
  "item1_unit_price": "item1_unit_price",
  "item1_line_total": "item1_line_total",
  "item2_desc": "item2_desc",
  "item2_qty": "item2_qty",
  "item2_unit_price": "item2_unit_price",
  "item2_line_total": "item2_line_total",
  "item3_desc": "item3_desc",
  "item3_qty": "item3_qty",
  "item3_unit_price": "item3_unit_price",
  "item3_line_total": "item3_line_total",
  "item4_desc": "item4_desc",
  "item4_qty": "item4_qty",
  "item4_unit_price": "item4_unit_price",
  "item4_line_total": "item4_line_total",
  "item5_desc": "item5_desc",
  "item5_qty": "item5_qty",
  "item5_unit_price": "item5_unit_price",
  "item5_line_total": "item5_line_total"
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
  subtotal: z.string().optional(),
  tax: z.string().optional(),
  total: z.string().optional(),
  payment_terms: z.string().optional(),
  bill_to_address: z.string().optional(),
  issue_date: z.string().optional(),
  due_date: z.string().min(1),
  status: z.string().optional(),
  item1_desc: z.string().optional(),
  item1_qty: z.string().optional(),
  item1_unit_price: z.string().optional(),
  item1_line_total: z.string().optional(),
  item2_desc: z.string().optional(),
  item2_qty: z.string().optional(),
  item2_unit_price: z.string().optional(),
  item2_line_total: z.string().optional(),
  item3_desc: z.string().optional(),
  item3_qty: z.string().optional(),
  item3_unit_price: z.string().optional(),
  item3_line_total: z.string().optional(),
  item4_desc: z.string().optional(),
  item4_qty: z.string().optional(),
  item4_unit_price: z.string().optional(),
  item4_line_total: z.string().optional(),
  item5_desc: z.string().optional(),
  item5_qty: z.string().optional(),
  item5_unit_price: z.string().optional(),
  item5_line_total: z.string().optional()
});

export type ParsedRow = z.infer<typeof RowSchema> & {
  normalized: {
    amount: number;
    currency: string;
    issue_date: Date | null;
    due_date: Date;
    status: "open" | "partial" | "paid" | "void";
    subtotal?: number | null;
    tax?: number | null;
    total?: number | null;
    payment_terms?: string | null;
    bill_to_address?: string | null;
  };
  line_items: {
    description: string;
    quantity?: number | null;
    unit_price?: number | null;
    line_total?: number | null;
    position: number;
  }[];
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

function parseOptionalNumber(value?: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractLineItems(row: z.infer<typeof RowSchema>) {
  const lineItems: {
    description: string;
    quantity?: number | null;
    unit_price?: number | null;
    line_total?: number | null;
    position: number;
  }[] = [];

  for (let i = 1; i <= 5; i += 1) {
    const typedRow = row as Record<string, string | undefined>;
    const description = typedRow[`item${i}_desc`];
    const qty = typedRow[`item${i}_qty`];
    const unitPrice = typedRow[`item${i}_unit_price`];
    const lineTotal = typedRow[`item${i}_line_total`];

    if (!description || description.trim().length === 0) continue;

    lineItems.push({
      description: description.trim(),
      quantity: parseOptionalNumber(qty),
      unit_price: parseOptionalNumber(unitPrice),
      line_total: parseOptionalNumber(lineTotal),
      position: i
    });
  }

  return lineItems;
}

export function parseInvoiceCsv(csvText: string) {
  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader
  });

  const criticalErrors = errors.filter((error) => {
    if (error.code === "TooFewFields" || error.code === "TooManyFields") {
      return false;
    }
    if (error.type === "FieldMismatch") return false;
    return true;
  });

  if (criticalErrors.length) {
    return {
      rows: [],
      errors: criticalErrors.map((error) => error.message)
    };
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
    const subtotal = parseOptionalNumber(result.data.subtotal);
    const tax = parseOptionalNumber(result.data.tax);
    const total = parseOptionalNumber(result.data.total);
    const paymentTerms = result.data.payment_terms?.trim() || null;
    const billToAddress = result.data.bill_to_address?.trim() || null;

    rows.push({
      ...result.data,
      normalized: {
        amount,
        currency: result.data.currency?.trim() || "USD",
        issue_date: issueDate,
        due_date: dueDate,
        status: normalizeStatus(result.data.status),
        subtotal,
        tax,
        total,
        payment_terms: paymentTerms,
        bill_to_address: billToAddress
      },
      line_items: extractLineItems(result.data)
    });
  });

  return { rows, errors: errorMessages };
}
