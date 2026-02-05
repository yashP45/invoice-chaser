import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import { reminderStage } from "@/lib/reminders";
import { DEFAULT_BODY, DEFAULT_SUBJECT, renderTemplate } from "@/lib/email/templates";
import { getRequestIp, rateLimit } from "@/lib/utils/rate-limit";

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

  let body: { subject_template?: string; body_template?: string } = {};
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
      "id, invoice_number, amount, currency, due_date, status, source_file_path, clients(name, email)"
    )
    .eq("user_id", user.id);
  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 400 });
  }

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@example.com";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "invoice_uploads";
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

  const invoiceIds = invoices.map((invoice) => invoice.id);
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
  const failures: { invoice_id: string; error: string }[] = [];

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
      const templateData = {
        client_name: client?.name || "there",
        invoice_number: invoice.invoice_number,
        amount: `${invoice.currency || "USD"} ${Number(invoice.amount).toFixed(2)}`,
        due_date: formatDate(invoice.due_date),
        days_overdue: overdue,
        sender_name: senderName,
        company_name: companyName
      };

      const subject = renderTemplate(
        subjectTemplate,
        templateData
      );
      const text = renderTemplate(
        bodyTemplate,
        templateData
      );

      let attachments:
        | {
            filename: string;
            content: Buffer;
            contentType?: string;
          }[]
        | undefined;

      if (invoice.source_file_path && invoice.source_file_path.toLowerCase().endsWith(".pdf")) {
        try {
          const { data: fileData, error: fileError } = await admin.storage
            .from(bucket)
            .download(invoice.source_file_path);

          if (!fileError && fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            if (arrayBuffer.byteLength <= MAX_ATTACHMENT_BYTES) {
              const filename =
                invoice.source_file_path.split("/").pop() || "invoice.pdf";
              attachments = [
                {
                  filename,
                  content: Buffer.from(arrayBuffer),
                  contentType: "application/pdf"
                }
              ];
            }
          }
        } catch {
          attachments = undefined;
        }
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

  return NextResponse.json({ sent, failed, failures });
}
