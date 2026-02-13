export type InvoiceDataForResolver = {
  invoice_number?: string;
  amount?: number;
  currency?: string;
  due_date?: string;
  issue_date?: string;
  payment_terms?: string;
  bill_to_address?: string;
  client_name?: string;
  client_email?: string;
  line_items?: Array<{
    description?: string;
    quantity?: number;
    unit_price?: number;
    line_total?: number;
  }>;
};

export type TokenResolution = {
  key: string;
  value: string;
  confidence: number;
};

const CONFIDENCE_AUTO_FILL = 0.7;
const CONFIDENCE_LOW_THRESHOLD = 0.3;

/**
 * Resolve all custom tokens in a single AI call with confidence scores.
 * Returns one entry per token key; confidence 0–1 (use empty value when nothing fits).
 */
export async function resolveTokensBatch(
  tokenKeys: string[],
  invoiceData: InvoiceDataForResolver
): Promise<TokenResolution[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || tokenKeys.length === 0) {
    return tokenKeys.map((key) => ({ key, value: "", confidence: 0 }));
  }

  const payload = JSON.stringify(invoiceData, null, 0);

  const prompt = `You are a helper that fills template placeholder values from invoice data.

Placeholder keys to fill (one value per key): ${JSON.stringify(tokenKeys)}

Invoice data (JSON): ${payload}

For each key, suggest a single short value from the invoice data that best fits (e.g. for "project_name" use a line item description; for "po_number" use a reference if present).
Respond with a JSON object exactly in this shape, no other text:
{"tokens":[{"key":"<key>","value":"<short value or empty string>","confidence":<0.0 to 1.0>}]}

Rules:
- Include every key from the list. Use value "" and confidence 0 when nothing in the data fits.
- confidence: 1.0 = exact match in data, 0.7–0.9 = strong inference, 0.4–0.6 = guess, 0–0.3 = weak or no fit.
- Keep each value short (a few words max).`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("resolveTokensBatch error:", data?.error?.message);
      return tokenKeys.map((key) => ({ key, value: "", confidence: 0 }));
    }

    const content = data?.choices?.[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(content) as { tokens?: Array<{ key?: string; value?: string; confidence?: number }> };
    const tokens = parsed?.tokens || [];
    const byKey = new Map<string, TokenResolution>();
    for (const t of tokens) {
      const key = t.key && typeof t.key === "string" ? t.key.trim().toLowerCase().replace(/\s+/g, "_") : "";
      if (!key || !tokenKeys.includes(key)) continue;
      const value = typeof t.value === "string" ? t.value.trim() : "";
      const confidence = typeof t.confidence === "number" ? Math.max(0, Math.min(1, t.confidence)) : 0;
      if (!byKey.has(key)) byKey.set(key, { key, value, confidence });
    }
    return tokenKeys.map((key) => byKey.get(key) ?? { key, value: "", confidence: 0 });
  } catch (error) {
    console.error("resolveTokensBatch failed:", error);
    return tokenKeys.map((key) => ({ key, value: "", confidence: 0 }));
  }
}

export function isAutoFillConfidence(confidence: number): boolean {
  return confidence >= CONFIDENCE_AUTO_FILL;
}

export function isLowConfidence(confidence: number): boolean {
  return confidence < CONFIDENCE_LOW_THRESHOLD;
}

/**
 * @deprecated Use resolveTokensBatch for one call per request. Kept for fallback.
 */
export async function resolveTokenWithAi(
  tokenKey: string,
  invoiceData: InvoiceDataForResolver
): Promise<string> {
  const results = await resolveTokensBatch([tokenKey], invoiceData);
  const r = results[0];
  return r ? r.value : "";
}

/**
 * Resolve multiple custom tokens (uses batch internally; returns flat map for backward compatibility).
 */
export async function resolveTokensWithAi(
  tokenKeys: string[],
  invoiceData: InvoiceDataForResolver
): Promise<Record<string, string>> {
  const results = await resolveTokensBatch(tokenKeys, invoiceData);
  const result: Record<string, string> = {};
  for (const r of results) {
    if (r.value) result[r.key] = r.value;
  }
  return result;
}
