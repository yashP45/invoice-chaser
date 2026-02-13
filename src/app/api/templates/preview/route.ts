import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { renderTemplate, BUILTIN_TOKEN_KEYS } from "@/lib/email/templates";
import { extractTokens } from "@/lib/email/template-schema";
import { resolveTokensBatch } from "@/lib/email/resolve-token-with-ai";

export const runtime = "nodejs";

const SAMPLE_INVOICE = {
  invoice_number: "INV-2401",
  amount: 1250,
  currency: "USD",
  due_date: "2026-01-15",
  issue_date: "2025-12-15",
  payment_terms: "Net 30",
  bill_to_address: "123 Main St, City",
  client_name: "Bluehill Media",
  client_email: "billing@bluehill.io",
  line_items: [
    { description: "Website redesign", quantity: 1, unit_price: 1250, line_total: 1250 }
  ]
};

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { subject?: string; body?: string; company_name?: string; sender_name?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject : "";
  const bodyText = typeof body.body === "string" ? body.body : "";
  const companyName = typeof body.company_name === "string" ? body.company_name : "Your Company";
  const senderName =
    typeof body.sender_name === "string" ? body.sender_name : (user.user_metadata?.full_name as string) || "Accounts";

  const builtinData: Record<string, string | number> = {
    client_name: SAMPLE_INVOICE.client_name,
    invoice_number: SAMPLE_INVOICE.invoice_number,
    amount: `${SAMPLE_INVOICE.currency} ${SAMPLE_INVOICE.amount.toFixed(2)}`,
    due_date: "Jan 15, 2026",
    days_overdue: 14,
    sender_name: senderName,
    company_name: companyName
  };

  const allTokenKeys = [...new Set([...extractTokens(subject), ...extractTokens(bodyText)])];
  const builtinSet = new Set<string>(BUILTIN_TOKEN_KEYS);
  const customTokenKeys = allTokenKeys.filter((k) => !builtinSet.has(k));

  let customValues: Record<string, string> = {};
  const tokenConfidence: Record<string, number> = {};

  if (customTokenKeys.length > 0) {
    const batchResults = await resolveTokensBatch(customTokenKeys, SAMPLE_INVOICE);
    for (const r of batchResults) {
      customValues[r.key] = r.value;
      tokenConfidence[r.key] = r.confidence;
    }
  }

  const templateData: Record<string, string | number> = {
    ...builtinData,
    ...customValues
  };

  const preview_subject = renderTemplate(subject, templateData);
  const preview_body = renderTemplate(bodyText, templateData);

  return NextResponse.json({
    preview_subject,
    preview_body,
    token_confidence: tokenConfidence,
    token_values: customValues
  });
}
