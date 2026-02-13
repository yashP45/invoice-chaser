import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export type DashboardSummaryPayload = {
  overdueCount: number;
  overdueAmount: number;
  remindersThisWeek: number;
  eligibleForReminder: number;
  suggestedActionText: string;
  effectivenessLabel: string;
  topOverdue: Array<{
    invoice_number: string;
    client_name: string;
    days_overdue: number;
    amount: number;
    currency: string;
  }>;
  expectedInflow: number;
};

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: DashboardSummaryPayload;
  try {
    const body = await request.json();
    payload = body as DashboardSummaryPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI summary not configured", summary: "" },
      { status: 200 }
    );
  }

  const topOverdueText =
    payload.topOverdue?.length > 0
      ? payload.topOverdue
          .map(
            (o) =>
              `${o.invoice_number} (${o.client_name}, ${o.days_overdue}d overdue, ${o.currency} ${o.amount.toFixed(2)})`
          )
          .join("; ")
      : "None";

  const prompt = `You are a concise assistant for an invoice and reminder dashboard. Based on the following data, write 2-3 short sentences summarizing the situation and one concrete next step. Be direct and professional. Do not use markdown or bullet points.

Data:
- Overdue invoices: ${payload.overdueCount}
- Total overdue amount: $${payload.overdueAmount.toFixed(2)}
- Reminders sent this week: ${payload.remindersThisWeek}
- Invoices eligible for a reminder (not yet sent for current stage): ${payload.eligibleForReminder}
- Reminder effectiveness: ${payload.effectivenessLabel}
- Suggested action: ${payload.suggestedActionText || "None"}
- Top overdue: ${topOverdueText}
- If all open invoices paid in next 14 days, expected inflow: $${payload.expectedInflow.toFixed(2)}

Respond with a JSON object: {"summary": "your 2-3 sentences here"}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("dashboard-summary error:", data?.error?.message);
      return NextResponse.json(
        { error: data?.error?.message || "AI failed", summary: "" },
        { status: 200 }
      );
    }

    const content = data?.choices?.[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(content) as { summary?: string };
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("dashboard-summary failed:", error);
    return NextResponse.json(
      { error: "Failed to generate summary", summary: "" },
      { status: 200 }
    );
  }
}
