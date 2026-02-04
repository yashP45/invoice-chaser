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
