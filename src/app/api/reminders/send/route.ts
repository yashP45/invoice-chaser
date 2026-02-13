import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import { reminderStage } from "@/lib/reminders";
import { DEFAULT_BODY, DEFAULT_SUBJECT, renderTemplate, BUILTIN_TOKEN_KEYS } from "@/lib/email/templates";
import { getRequestIp, rateLimit } from "@/lib/utils/rate-limit";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";
import { extractTokens } from "@/lib/email/template-schema";
import { resolveTokensBatch, isAutoFillConfidence } from "@/lib/email/resolve-token-with-ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(request) || "unknown";
  const limit = rateLimit(`reminders-send:${user.id}:${ip}`, { windowMs: 60_000, max: 20 });
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many reminder sends. Please wait a moment.", retry_after: retryAfter },
      { status: 429 }
    );
  }

  let body: { invoice_id?: string; token_overrides?: Record<string, string> } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const { invoice_id, token_overrides = {} } = body;
  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id required" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, due_date, issue_date, status, source_file_path, subtotal, tax, total, payment_terms, bill_to_address, clients(name, email)"
    )
    .eq("id", invoice_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!(invoice.status === "open" || invoice.status === "partial")) {
    return NextResponse.json(
      { sent: 0, skipped: true, reason: "Invoice is not open or partial." },
      { status: 200 }
    );
  }

  const overdue = daysOverdue(invoice.due_date);
  const stage = reminderStage(overdue);
  if (stage === 0) {
    return NextResponse.json(
      { sent: 0, skipped: true, reason: "Invoice is not overdue yet." },
      { status: 200 }
    );
  }

  const { data: existingReminders } = await admin
    .from("reminders")
    .select("id, reminder_stage, status")
    .eq("invoice_id", invoice.id)
    .eq("user_id", user.id);

  const alreadySent = (existingReminders || []).some(
    (reminder) => reminder.reminder_stage === stage && reminder.status !== "failed"
  );

  if (alreadySent) {
    return NextResponse.json(
      { sent: 0, skipped: true, reason: "Reminder already sent for this stage." },
      { status: 200 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@example.com";
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

  const { data: settings } = await admin
    .from("users")
    .select("company_name, sender_name, reply_to, reminder_subject, reminder_body, custom_template_fields")
    .eq("id", user.id)
    .maybeSingle();

  const senderName =
    settings?.sender_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    "Accounts Team";
  const companyName = settings?.company_name || "Your Company";

  const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
  const clientEmail = client?.email;
  if (!clientEmail) {
    return NextResponse.json({ error: "Client email missing" }, { status: 400 });
  }

  const subjectTemplate = settings?.reminder_subject || DEFAULT_SUBJECT;
  const bodyTemplate = settings?.reminder_body || DEFAULT_BODY;
  const allTokenKeys = [
    ...new Set([...extractTokens(subjectTemplate), ...extractTokens(bodyTemplate)])
  ];
  const builtinSet = new Set(BUILTIN_TOKEN_KEYS);
  const customTokenKeys = allTokenKeys.filter((k) => !builtinSet.has(k));

  const builtinData: Record<string, string | number> = {
    client_name: client?.name || "there",
    invoice_number: invoice.invoice_number,
    amount: `${invoice.currency || "USD"} ${Number(invoice.amount).toFixed(2)}`,
    due_date: formatDate(invoice.due_date),
    days_overdue: overdue,
    sender_name: senderName,
    company_name: companyName
  };

  const { data: lineItems } = await admin
    .from("invoice_line_items")
    .select("description, quantity, unit_price, line_total")
    .eq("invoice_id", invoice.id)
    .order("position", { ascending: true });

  const hasOverrides = Object.keys(token_overrides).length > 0;
  const customValues: Record<string, string> = {};

  if (hasOverrides) {
    for (const key of customTokenKeys) {
      const v = token_overrides[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        customValues[key] = String(v).trim();
      }
    }
    const missingAfterOverride = customTokenKeys.filter((k) => !customValues[k]);
    if (missingAfterOverride.length > 0) {
      return NextResponse.json(
        {
          needs_input: true,
          missing_tokens: missingAfterOverride,
          ai_suggestions: {},
          token_confidence: {},
          invoice_id: invoice.id
        },
        { status: 200 }
      );
    }
  } else {
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
      line_items: lineItems?.map((item) => ({
        description: item.description ?? undefined,
        quantity: item.quantity ?? undefined,
        unit_price: item.unit_price ?? undefined,
        line_total: item.line_total ?? undefined
      }))
    };

    const batchResults = await resolveTokensBatch(customTokenKeys, invoiceDataForAi);
    const needsReview: string[] = [];
    const aiSuggestions: Record<string, string> = {};
    const tokenConfidence: Record<string, number> = {};

    for (const r of batchResults) {
      tokenConfidence[r.key] = r.confidence;
      if (isAutoFillConfidence(r.confidence) && r.value) {
        customValues[r.key] = r.value;
      } else {
        needsReview.push(r.key);
        if (r.value) aiSuggestions[r.key] = r.value;
      }
    }

    const stillMissing = needsReview.filter((k) => !customValues[k]);
    if (stillMissing.length > 0) {
      return NextResponse.json(
        {
          needs_input: true,
          missing_tokens: stillMissing,
          ai_suggestions: Object.fromEntries(
            customTokenKeys.map((k) => [k, aiSuggestions[k] ?? null])
          ),
          token_confidence: Object.fromEntries(
            customTokenKeys.map((k) => [k, tokenConfidence[k] ?? 0])
          ),
          invoice_id: invoice.id
        },
        { status: 200 }
      );
    }
  }

  const missingBeforeSend = customTokenKeys.filter(
    (k) => !customValues[k] || String(customValues[k]).trim() === ""
  );
  if (missingBeforeSend.length > 0) {
    return NextResponse.json(
      {
        needs_input: true,
        missing_tokens: missingBeforeSend,
        ai_suggestions: {},
        token_confidence: {},
        invoice_id: invoice.id
      },
      { status: 200 }
    );
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
        lineItems:
          lineItems?.map((item) => ({
            description: item.description || "",
            quantity: item.quantity ?? undefined,
            unitPrice: item.unit_price ?? undefined,
            lineTotal: item.line_total ?? undefined
          })) || []
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
    console.error("Failed to generate invoice PDF:", error);
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
    await admin.from("reminders").insert({
      user_id: user.id,
      invoice_id: invoice.id,
      reminder_stage: stage,
      status: "failed",
      sent_at: new Date().toISOString(),
      email_id: null
    });
    return NextResponse.json({ sent: 0, failed: 1, error: error.message }, { status: 400 });
  }

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

  return NextResponse.json({ sent: 1, failed: 0 });
}
