import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const InvoiceSchema = z.object({
  client_id: z.string().optional(),
  client_name: z.string().min(1),
  client_email: z.string().email(),
  invoice_number: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1).default("USD"),
  issue_date: z.string().optional(),
  due_date: z.string().min(1),
  status: z.enum(["open", "partial", "paid", "void"]).default("open")
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

  const { error: invoiceError } = await admin
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
        paid_at: paidAt
      },
      { onConflict: "user_id,invoice_number" }
    );

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
