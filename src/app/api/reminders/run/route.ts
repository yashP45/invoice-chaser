import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import { reminderStage } from "@/lib/reminders";
import { DEFAULT_BODY, DEFAULT_SUBJECT, renderTemplate, BUILTIN_TOKEN_KEYS } from "@/lib/email/templates";
import { getRequestIp, rateLimit } from "@/lib/utils/rate-limit";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";
import { extractTokens } from "@/lib/email/template-schema";
import { resolveTokensBatch, isLowConfidence } from "@/lib/email/resolve-token-with-ai";

const CUSTOM_TOKEN_ALIASES: Record<string, string> = {
  invoice_amount: "amount",
  invoice_date: "due_date",
  total: "amount",
  invoice_total: "amount"
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(request) || "unknown";
  const limit = rateLimit(`reminders-run:${user.id}:${ip}`, { windowMs: 60_000, max: 10 });
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many reminder runs. Please wait a moment.", retry_after: retryAfter },
      { status: 429 }
    );
  }

  let body: {
    subject_template?: string;
    body_template?: string;
    overrides_by_invoice?: Record<string, Record<string, string>>;
  } = {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      body = await request.json();
    }
  } catch {
    body = {};
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  const { data: invoices, error: invoiceError } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, due_date, issue_date, status, source_file_path, subtotal, tax, total, payment_terms, bill_to_address, clients(name, email)"
    )
    .eq("user_id", user.id);
  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 400 });
  }

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: 0 });
  }

  // Batch fetch line items for all invoices
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const { data: allLineItems } = await admin
    .from("invoice_line_items")
    .select("invoice_id, description, quantity, unit_price, line_total, position")
    .in("invoice_id", invoiceIds)
    .order("invoice_id", { ascending: true })
    .order("position", { ascending: true });

  // Group line items by invoice_id
  const lineItemsByInvoice = new Map<string, typeof allLineItems>();
  allLineItems?.forEach((item) => {
    const items = lineItemsByInvoice.get(item.invoice_id) || [];
    items.push(item);
    lineItemsByInvoice.set(item.invoice_id, items);
  });

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@example.com";
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

  const { data: settings } = await admin
    .from("users")
    .select("company_name, sender_name, reply_to, reminder_subject, reminder_body")
    .eq("id", user.id)
    .maybeSingle();

  const senderName =
    settings?.sender_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    "Accounts Team";
  const companyName = settings?.company_name || "Your Company";
  const subjectTemplate =
    body.subject_template || settings?.reminder_subject || DEFAULT_SUBJECT;
  const bodyTemplate = body.body_template || settings?.reminder_body || DEFAULT_BODY;

  const allTokenKeys = [
    ...new Set([...extractTokens(subjectTemplate), ...extractTokens(bodyTemplate)])
  ];
  const builtinSet = new Set<string>(BUILTIN_TOKEN_KEYS);
  const customTokenKeys = allTokenKeys.filter((k) => !builtinSet.has(k));

  const { data: reminders, error: reminderError } = await admin
    .from("reminders")
    .select("invoice_id, reminder_stage, status")
    .in("invoice_id", invoiceIds);
  if (reminderError) {
    return NextResponse.json({ error: reminderError.message }, { status: 400 });
  }

  const sentMap = new Set(
    (reminders || [])
      .filter((row) => row.status !== "failed")
      .map((row) => `${row.invoice_id}:${row.reminder_stage}`)
  );

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const failures: { invoice_id: string; error: string }[] = [];
  const skipped_invoices: { invoice_id: string; reason: string }[] = [];

  for (const invoice of invoices) {
    if (!(invoice.status === "open" || invoice.status === "partial")) continue;

    const overdue = daysOverdue(invoice.due_date);
    const stage = reminderStage(overdue);
    if (stage === 0) continue;

    const reminderKey = `${invoice.id}:${stage}`;
    if (sentMap.has(reminderKey)) continue;

    const client =
      Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
    const clientEmail = client?.email;
    if (!clientEmail) continue;

    try {
      const builtinData: Record<string, string | number> = {
        client_name: client?.name || "there",
        invoice_number: invoice.invoice_number,
        amount: `${invoice.currency || "USD"} ${Number(invoice.amount).toFixed(2)}`,
        due_date: formatDate(invoice.due_date),
        days_overdue: overdue,
        sender_name: senderName,
        company_name: companyName
      };

      const customValues: Record<string, string> = {};
      for (const key of customTokenKeys) {
        const builtinKey = CUSTOM_TOKEN_ALIASES[key];
        if (builtinKey && builtinData[builtinKey] !== undefined && builtinData[builtinKey] !== null) {
          customValues[key] = String(builtinData[builtinKey]);
        }
      }
      if (customTokenKeys.length > 0) {
        const keysToResolve = customTokenKeys.filter((k) => !(k in customValues));
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
            customValues[r.key] = isLowConfidence(r.confidence) ? "" : (r.value || "");
          }
        }
        const overrides = body.overrides_by_invoice?.[invoice.id] ?? {};
        for (const [key, value] of Object.entries(overrides)) {
          if (customTokenKeys.includes(key) && value != null && String(value).trim() !== "") {
            customValues[key] = String(value).trim();
          }
        }
        const hasEmptyCustom = customTokenKeys.some(
          (k) => !customValues[k] || String(customValues[k]).trim() === ""
        );
        if (hasEmptyCustom) {
          skipped += 1;
          skipped_invoices.push({ invoice_id: invoice.id, reason: "missing placeholders" });
          continue;
        }
      }

      const templateData: Record<string, string | number> = {
        ...builtinData,
        ...customValues
      };

      const subject = renderTemplate(subjectTemplate, templateData);
      const text = renderTemplate(bodyTemplate, templateData);

      // Always attach generated invoice PDF (never original upload)
      let attachments:
        | {
            filename: string;
            content: Buffer;
            contentType?: string;
          }[]
        | undefined;

      try {
        const lineItems = lineItemsByInvoice.get(invoice.id) || [];
        const pdfBuffer = await generateInvoicePdf(
          {
            invoiceNumber: invoice.invoice_number,
            clientName: client?.name || "Client",
            clientEmail: client?.email,
            clientAddress: invoice.bill_to_address || undefined,
            issueDate: invoice.issue_date || undefined,
            dueDate: invoice.due_date,
            paymentTerms: invoice.payment_terms || undefined,
            currency: invoice.currency || "USD",
            subtotal: invoice.subtotal ?? undefined,
            tax: invoice.tax ?? undefined,
            total: Number(invoice.amount),
            lineItems: lineItems.map((item) => ({
              description: item.description || "",
              quantity: item.quantity ?? undefined,
              unitPrice: item.unit_price ?? undefined,
              lineTotal: item.line_total ?? undefined
            }))
          },
          {
            companyName,
            senderName
          }
        );

        if (pdfBuffer.length <= MAX_ATTACHMENT_BYTES) {
          attachments = [
            {
              filename: `Invoice-${invoice.invoice_number}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf"
            }
          ];
        }
      } catch (error) {
        console.error(`Failed to generate PDF for invoice ${invoice.id}:`, error);
      }

      const { data, error } = await resend.emails.send({
        from: `${senderName} <${fromEmail}>`,
        to: clientEmail,
        subject,
        text,
        reply_to: settings?.reply_to || undefined,
        attachments
      });

      if (error) {
        failed += 1;
        failures.push({ invoice_id: invoice.id, error: error.message });
        await admin.from("reminders").insert({
          user_id: user.id,
          invoice_id: invoice.id,
          reminder_stage: stage,
          status: "failed",
          sent_at: new Date().toISOString(),
          email_id: null
        });
        continue;
      }

      sent += 1;
      await admin.from("reminders").insert({
        user_id: user.id,
        invoice_id: invoice.id,
        reminder_stage: stage,
        status: "sent",
        sent_at: new Date().toISOString(),
        email_id: data?.id || null
      });
      await admin
        .from("invoices")
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq("id", invoice.id)
        .eq("user_id", user.id);
    } catch (error) {
      failed += 1;
      failures.push({
        invoice_id: invoice.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  return NextResponse.json({ sent, failed, skipped, failures, skipped_invoices });
}
