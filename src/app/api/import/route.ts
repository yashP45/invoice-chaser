import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { parseInvoiceCsv } from "@/lib/utils/csv";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "CSV file required" }, { status: 400 });
  }

  const text = await file.text();
  const { rows, errors } = parseInvoiceCsv(text);

  if (errors.length) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  if (!rows.length) {
    return NextResponse.json({ error: "No rows found" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  await admin.from("users").upsert({
    id: user.id,
    email: user.email
  });

  const uniqueClients = new Map<string, { name: string; email: string }>();
  rows.forEach((row) => {
    uniqueClients.set(row.client_email.toLowerCase(), {
      name: row.client_name,
      email: row.client_email.toLowerCase()
    });
  });

  const clientRows = Array.from(uniqueClients.values()).map((client) => ({
    user_id: user.id,
    name: client.name,
    email: client.email
  }));

  const { error: clientError } = await admin.from("clients").upsert(clientRows, {
    onConflict: "user_id,email"
  });

  if (clientError) {
    return NextResponse.json(
      { error: `Client import failed: ${clientError.message}` },
      { status: 400 }
    );
  }

  const { data: clients, error: clientFetchError } = await admin
    .from("clients")
    .select("id, email")
    .eq("user_id", user.id)
    .in(
      "email",
      clientRows.map((row) => row.email)
    );
  if (clientFetchError) {
    return NextResponse.json(
      { error: `Client lookup failed: ${clientFetchError.message}` },
      { status: 400 }
    );
  }

  const clientMap = new Map<string, string>();
  clients?.forEach((client) => {
    clientMap.set(client.email.toLowerCase(), client.id);
  });

  const invoiceRows = rows.map((row) => ({
    user_id: user.id,
    client_id: clientMap.get(row.client_email.toLowerCase()),
    invoice_number: row.invoice_number,
    amount: row.normalized.amount,
    currency: row.normalized.currency,
    issue_date: row.normalized.issue_date?.toISOString().slice(0, 10) || null,
    due_date: row.normalized.due_date.toISOString().slice(0, 10),
    status: row.normalized.status
  }));

  const { error: invoiceError } = await admin
    .from("invoices")
    .upsert(invoiceRows, {
      onConflict: "user_id,invoice_number"
    });
  if (invoiceError) {
    return NextResponse.json(
      { error: `Invoice import failed: ${invoiceError.message}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    inserted: invoiceRows.length,
    skipped: 0
  });
}
