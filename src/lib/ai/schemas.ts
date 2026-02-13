import { z } from "zod";

export const invoiceExtractionSchema = {
  name: "invoice_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      client_name: { type: "string" },
      client_email: { type: "string" },
      client_address: { type: "string" },
      invoice_number: { type: "string" },
      invoice_date: { type: "string" },
      due_date: { type: "string" },
      payment_terms: { type: "string" },
      currency: { type: "string" },
      subtotal: { type: "number" },
      tax: { type: "number" },
      total: { type: "number" },
      line_items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: "number" },
            line_total: { type: "number" }
          },
          required: ["description", "quantity", "unit_price", "line_total"]
        }
      },
      confidence: { type: "number" }
    },
    required: [
      "client_name",
      "client_email",
      "client_address",
      "invoice_number",
      "invoice_date",
      "due_date",
      "payment_terms",
      "currency",
      "subtotal",
      "tax",
      "total",
      "line_items",
      "confidence"
    ]
  }
} as const;

export const reminderVariantSchema = {
  name: "reminder_variants",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      variants: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            subject: { type: "string" },
            body: { type: "string" }
          },
          required: ["subject", "body"]
        }
      }
    },
    required: ["variants"]
  }
} as const;

// Zod schemas for runtime validation
const LineItemZod = z.object({
  description: z.string(),
  quantity: z.coerce.number(),
  unit_price: z.coerce.number(),
  line_total: z.coerce.number()
});

export const InvoiceExtractionZod = z.object({
  client_name: z.string().default(""),
  client_email: z.string().default(""),
  client_address: z.string().default(""),
  invoice_number: z.string().default(""),
  invoice_date: z.string().default(""),
  due_date: z.string().default(""),
  payment_terms: z.string().default(""),
  currency: z.string().default("USD"),
  subtotal: z.coerce.number(),
  tax: z.coerce.number(),
  total: z.coerce.number(),
  line_items: z.array(LineItemZod).default([]),
  confidence: z.coerce.number().min(0).max(1)
});

export const ReminderVariantsZod = z.object({
  variants: z.array(
    z.object({
      subject: z.string(),
      body: z.string()
    })
  )
});
