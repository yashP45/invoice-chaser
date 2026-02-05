import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import { reminderStage } from "@/lib/reminders";
import { DEFAULT_BODY, DEFAULT_SUBJECT, renderTemplate } from "@/lib/email/templates";
import { getRequestIp, rateLimit } from "@/lib/utils/rate-limit";

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

  const { invoice_id } = await request.json();
  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id required" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, due_date, status, source_file_path, clients(name, email)"
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

  const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
  const clientEmail = client?.email;
  if (!clientEmail) {
    return NextResponse.json({ error: "Client email missing" }, { status: 400 });
  }

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
    settings?.reminder_subject || DEFAULT_SUBJECT,
    templateData
  );
  const text = renderTemplate(settings?.reminder_body || DEFAULT_BODY, templateData);

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
          const filename = invoice.source_file_path.split("/").pop() || "invoice.pdf";
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
