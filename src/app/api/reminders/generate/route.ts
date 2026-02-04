import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { reminderVariantSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

function extractResponseText(response: any) {
  if (typeof response?.output_text === "string") {
    return response.output_text;
  }

  const chunks: string[] = [];
  const output = response?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part?.type === "output_text" && typeof part.text === "string") {
            chunks.push(part.text);
          }
        }
      }
    }
  }
  return chunks.join("").trim();
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoice_id, tone } = await request.json();
  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id required" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: invoice, error } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, due_date, status, clients(name, email), users(company_name, sender_name)"
    )
    .eq("id", invoice_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
  const sender = Array.isArray(invoice.users) ? invoice.users[0] : invoice.users;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 400 });
  }

  const prompt = [
    "Generate 3 professional, polite reminder variants for a past due invoice.",
    "Return JSON matching the schema.",
    tone ? `Use tone: ${tone}.` : "Use a polite, firm tone.",
    `Client: ${client?.name || "Client"} (${client?.email || ""}).`,
    `Invoice: ${invoice.invoice_number} for ${invoice.currency || "USD"} ${Number(
      invoice.amount || 0
    ).toFixed(2)} due on ${invoice.due_date}.`,
    `Sender: ${sender?.sender_name || user.user_metadata?.full_name || "Accounts"} at ${
      sender?.company_name || "Your Company"
    }.`
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      text: {
        format: {
          type: "json_schema",
          name: reminderVariantSchema.name,
          schema: reminderVariantSchema.schema,
          strict: reminderVariantSchema.strict
        }
      },
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: data?.error?.message || "AI failed" }, { status: 400 });
  }

  const outputText = extractResponseText(data);
  return NextResponse.json(JSON.parse(outputText));
}
