import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { reminderVariantSchema, ReminderVariantsZod } from "@/lib/ai/schemas";

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

  const { invoice_id, tone, template } = await request.json();

  const admin = createAdminSupabaseClient();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 400 });
  }

  let prompt = "";

  if (template) {
    const { data: settings } = await admin
      .from("users")
      .select("company_name, sender_name")
      .eq("id", user.id)
      .maybeSingle();

    prompt = [
      "Generate 3 professional, polite reminder templates for a past due invoice.",
      "Return JSON matching the schema.",
      tone ? `Use tone: ${tone}.` : "Use a polite, firm tone.",
      "Use ONLY these tokens in the subject/body (do not add others):",
      "{{client_name}}, {{invoice_number}}, {{amount}}, {{due_date}}, {{days_overdue}}, {{sender_name}}, {{company_name}}.",
      "Do not include real values. Output templates only.",
      `Sender name token should represent: ${settings?.sender_name || user.user_metadata?.full_name || "Accounts"}.`,
      `Company name token should represent: ${settings?.company_name || "Your Company"}.`
    ].join(" ");
  } else {
    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id required" }, { status: 400 });
    }

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

    prompt = [
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
  }

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
  if (!outputText) {
    return NextResponse.json(
      { error: "AI response contained no output text" },
      { status: 422 }
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(outputText);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to parse AI response as JSON",
        details: error instanceof Error ? error.message : "Unknown parsing error"
      },
      { status: 422 }
    );
  }

  const validationResult = ReminderVariantsZod.safeParse(parsedJson);
  if (!validationResult.success) {
    const issues = validationResult.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));
    return NextResponse.json(
      {
        error: "AI response validation failed",
        details: issues
      },
      { status: 422 }
    );
  }

  return NextResponse.json(validationResult.data);
}
