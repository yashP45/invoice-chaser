import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import { reminderStage } from "@/lib/reminders";
import { DEFAULT_BODY, DEFAULT_SUBJECT, BUILTIN_TOKEN_KEYS } from "@/lib/email/templates";
import { getRequestIp, rateLimit } from "@/lib/utils/rate-limit";
import { extractTokens } from "@/lib/email/template-schema";
import { resolveTokensBatch, isAutoFillConfidence } from "@/lib/email/resolve-token-with-ai";

const CUSTOM_TOKEN_ALIASES: Record<string, string> = {
  invoice_amount: "amount",
  invoice_date: "due_date",
  total: "amount",
  invoice_total: "amount"
};

export const runtime = "nodejs";

export type PreviewInvoice = {
  invoice_id: string;
  invoice_number: string;
  client_name: string;
  missing_tokens: string[];
  ai_suggestions: Record<string, string>;
};

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(request) || "unknown";
  const limit = rateLimit(`reminders-run-preview:${user.id}:${ip}`, { windowMs: 60_000, max: 20 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { subject_template?: string; body_template?: string } = {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      body = await request.json();
    }
  } catch {
    body = {};
  }

  const admin = createAdminSupabaseClient();
  const { data: settings } = await admin
    .from("users")
    .select("reminder_subject, reminder_body")
    .eq("id", user.id)
    .maybeSingle();

  const subjectTemplate =
    body.subject_template || settings?.reminder_subject || DEFAULT_SUBJECT;
  const bodyTemplate = body.body_template || settings?.reminder_body || DEFAULT_BODY;

  const allTokenKeys = [
    ...new Set([...extractTokens(subjectTemplate), ...extractTokens(bodyTemplate)])
  ];
  const builtinSet = new Set<string>(BUILTIN_TOKEN_KEYS);
  const customTokenKeys = allTokenKeys.filter((k) => !builtinSet.has(k));

  if (customTokenKeys.length === 0) {
    return NextResponse.json({ invoices: [] });
  }

  const { data: invoices, error: invoiceError } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, due_date, issue_date, status, payment_terms, bill_to_address, clients(name, email)"
    )
    .eq("user_id", user.id);
  if (invoiceError || !invoices?.length) {
    return NextResponse.json({ invoices: [] });
  }

  const { data: reminders } = await admin
    .from("reminders")
    .select("invoice_id, reminder_stage, status")
    .in("invoice_id", invoices.map((i) => i.id));
  const sentMap = new Set(
    (reminders || [])
      .filter((r) => r.status !== "failed")
      .map((r) => `${r.invoice_id}:${r.reminder_stage}`)
  );

  const { data: allLineItems } = await admin
    .from("invoice_line_items")
    .select("invoice_id, description, quantity, unit_price, line_total, position")
    .in("invoice_id", invoices.map((i) => i.id))
    .order("invoice_id")
    .order("position", { ascending: true });
  const lineItemsByInvoice = new Map<string, typeof allLineItems>();
  allLineItems?.forEach((item) => {
    const list = lineItemsByInvoice.get(item.invoice_id) || [];
    list.push(item);
    lineItemsByInvoice.set(item.invoice_id, list);
  });

  const result: PreviewInvoice[] = [];

  for (const invoice of invoices) {
    if (!(invoice.status === "open" || invoice.status === "partial")) continue;
    const overdue = daysOverdue(invoice.due_date);
    const stage = reminderStage(overdue);
    if (stage === 0) continue;
    if (sentMap.has(`${invoice.id}:${stage}`)) continue;
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
    if (!client?.email) continue;

    const builtinData: Record<string, string | number> = {
      client_name: client?.name || "there",
      invoice_number: invoice.invoice_number,
      amount: `${invoice.currency || "USD"} ${Number(invoice.amount).toFixed(2)}`,
      due_date: formatDate(invoice.due_date),
      days_overdue: overdue,
      sender_name: "Accounts",
      company_name: "Your Company"
    };

    const customValues: Record<string, string> = {};
    for (const key of customTokenKeys) {
      const builtinKey = CUSTOM_TOKEN_ALIASES[key];
      if (builtinKey && builtinData[builtinKey] != null) {
        customValues[key] = String(builtinData[builtinKey]);
      }
    }

    const keysToResolve = customTokenKeys.filter((k) => !(k in customValues));
    const aiSuggestions: Record<string, string> = {};
    if (keysToResolve.length > 0) {
      const lineItems = lineItemsByInvoice.get(invoice.id) || [];
      const invoiceDataForAi = {
        invoice_number: invoice.invoice_number,
        amount: Number(invoice.amount),
        currency: invoice.currency ?? undefined,
        due_date: invoice.due_date ?? undefined,
        issue_date: invoice.issue_date ?? undefined,
        payment_terms: invoice.payment_terms ?? undefined,
        bill_to_address: invoice.bill_to_address ?? undefined,
        client_name: client?.name ?? undefined,
        client_email: client?.email ?? undefined,
        line_items: lineItems.map((item) => ({
          description: item.description ?? undefined,
          quantity: item.quantity ?? undefined,
          unit_price: item.unit_price ?? undefined,
          line_total: item.line_total ?? undefined
        }))
      };
      const batchResults = await resolveTokensBatch(keysToResolve, invoiceDataForAi);
      for (const r of batchResults) {
        if (isAutoFillConfidence(r.confidence) && r.value) {
          customValues[r.key] = r.value;
        } else {
          if (r.value) aiSuggestions[r.key] = r.value;
        }
      }
    }

    const missing_tokens = customTokenKeys.filter(
      (k) => !customValues[k] || String(customValues[k]).trim() === ""
    );
    if (missing_tokens.length > 0) {
      result.push({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: client?.name || "—",
        missing_tokens,
        ai_suggestions: aiSuggestions
      });
    }
  }

  return NextResponse.json({ invoices: result });
}
