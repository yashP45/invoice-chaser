import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().optional(),
  unit_price: z.number().optional(),
  line_total: z.number().optional()
});

const InvoiceSchema = z.object({
  client_id: z.string().optional(),
  client_name: z.string().min(1),
  client_email: z.string().email(),
  invoice_number: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1).default("USD"),
  issue_date: z.string().optional(),
  due_date: z.string().min(1),
  status: z.enum(["open", "partial", "paid", "void"]).default("open"),
  subtotal: z.number().optional(),
  tax: z.number().optional(),
  total: z.number().optional(),
  payment_terms: z.string().optional(),
  bill_to_address: z.string().optional(),
  ai_extracted: z.boolean().optional(),
  ai_confidence: z.number().optional(),
  extracted_at: z.string().optional(),
  source_file_path: z.string().optional(),
  line_items: z.array(LineItemSchema).optional()
});

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const result = InvoiceSchema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json({ error: result.error.errors[0]?.message }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  await admin.from("users").upsert({
    id: user.id,
    email: user.email
  });

  let clientId = result.data.client_id || "";

  if (clientId) {
    const { data: existingClient, error: existingError } = await admin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError || !existingClient) {
      return NextResponse.json(
        { error: "Selected client not found." },
        { status: 400 }
      );
    }
    clientId = existingClient.id;
  } else {
    const { data: clientRows, error: clientError } = await admin
      .from("clients")
      .upsert(
        {
          user_id: user.id,
          name: result.data.client_name,
          email: result.data.client_email.toLowerCase()
        },
        { onConflict: "user_id,email" }
      )
      .select("id");

    if (clientError || !clientRows?.[0]?.id) {
      return NextResponse.json(
        { error: clientError?.message || "Client upsert failed" },
        { status: 400 }
      );
    }
    clientId = clientRows[0].id;
  }

  const paidAt = result.data.status === "paid" ? new Date().toISOString() : null;

  const { data: invoiceRow, error: invoiceError } = await admin
    .from("invoices")
    .upsert(
      {
        user_id: user.id,
        client_id: clientId,
        invoice_number: result.data.invoice_number,
        amount: result.data.amount,
        currency: result.data.currency || "USD",
        issue_date: result.data.issue_date || null,
        due_date: result.data.due_date,
        status: result.data.status,
        paid_at: paidAt,
        subtotal: result.data.subtotal ?? null,
        tax: result.data.tax ?? null,
        total: result.data.total ?? null,
        payment_terms: result.data.payment_terms ?? null,
        bill_to_address: result.data.bill_to_address ?? null,
        ai_extracted: result.data.ai_extracted ?? false,
        ai_confidence: result.data.ai_confidence ?? null,
        extracted_at: result.data.extracted_at ?? null,
        source_file_path: result.data.source_file_path ?? null
      },
      { onConflict: "user_id,invoice_number" }
    )
    .select("id")
    .maybeSingle();

  if (invoiceError || !invoiceRow?.id) {
    return NextResponse.json(
      { error: invoiceError?.message || "Invoice save failed" },
      { status: 400 }
    );
  }

  if (result.data.line_items?.length) {
    await admin.from("invoice_line_items").delete().eq("invoice_id", invoiceRow.id);
    await admin.from("invoice_line_items").insert(
      result.data.line_items.map((item, index) => ({
        invoice_id: invoiceRow.id,
        description: item.description,
        quantity: item.quantity ?? null,
        unit_price: item.unit_price ?? null,
        line_total: item.line_total ?? null,
        position: index
      }))
    );
  }

  if (result.data.source_file_path) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "invoice_uploads";
    const newPath = `${user.id}/invoices/${invoiceRow.id}/${result.data.source_file_path.split("/").pop()}`;
    await admin.storage.from(bucket).move(result.data.source_file_path, newPath);

    await admin.from("invoice_files").insert({
      user_id: user.id,
      invoice_id: invoiceRow.id,
      storage_path: newPath,
      file_name: newPath.split("/").pop(),
      mime_type: null,
      file_size: null,
      ai_confidence: result.data.ai_confidence ?? null
    });

    await admin
      .from("invoices")
      .update({ source_file_path: newPath })
      .eq("id", invoiceRow.id);
  }

  return NextResponse.json({ success: true });
}
