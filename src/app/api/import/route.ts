import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
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
    status: row.normalized.status,
    subtotal: row.normalized.subtotal ?? null,
    tax: row.normalized.tax ?? null,
    total: row.normalized.total ?? null,
    payment_terms: row.normalized.payment_terms ?? null,
    bill_to_address: row.normalized.bill_to_address ?? null,
    ai_extracted: false,
    ai_confidence: null,
    extracted_at: null,
    source_file_path: null
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

  const { data: importedInvoices, error: invoiceFetchError } = await admin
    .from("invoices")
    .select("id, invoice_number")
    .eq("user_id", user.id)
    .in(
      "invoice_number",
      invoiceRows.map((row) => row.invoice_number)
    );

  if (invoiceFetchError) {
    return NextResponse.json(
      { error: `Invoice lookup failed: ${invoiceFetchError.message}` },
      { status: 400 }
    );
  }

  const invoiceIdMap = new Map<string, string>();
  importedInvoices?.forEach((invoice) => {
    invoiceIdMap.set(invoice.invoice_number, invoice.id);
  });

  const lineItemRows = rows.flatMap((row) => {
    const invoiceId = invoiceIdMap.get(row.invoice_number);
    if (!invoiceId || row.line_items.length === 0) return [];
    return row.line_items.map((item) => ({
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity ?? null,
      unit_price: item.unit_price ?? null,
      line_total: item.line_total ?? null,
      position: item.position
    }));
  });

  if (importedInvoices && importedInvoices.length > 0) {
    const invoiceIds = importedInvoices.map((invoice) => invoice.id);
    const { error: deleteLineItemError } = await admin
      .from("invoice_line_items")
      .delete()
      .in("invoice_id", invoiceIds);

    if (deleteLineItemError) {
      return NextResponse.json(
        { error: `Line item cleanup failed: ${deleteLineItemError.message}` },
        { status: 400 }
      );
    }
  }

  if (lineItemRows.length > 0) {
    const { error: lineItemError } = await admin
      .from("invoice_line_items")
      .insert(lineItemRows);

    if (lineItemError) {
      return NextResponse.json(
        { error: `Line item import failed: ${lineItemError.message}` },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({
    inserted: invoiceRows.length,
    skipped: 0
  });
}
