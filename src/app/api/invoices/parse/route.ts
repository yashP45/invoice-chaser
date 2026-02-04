import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

function parseDateValue(raw: string | undefined) {
  if (!raw) return null;
  const cleaned = raw.trim();
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    const fallback = new Date(year, month - 1, day);
    if (!Number.isNaN(fallback.getTime())) return fallback;
  }

  return null;
}

function findFirst(regexes: RegExp[], text: string) {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "PDF file required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await pdfParse(buffer);
  const text = parsed.text.replace(/\s+/g, " ").trim();

  const aiEndpoint = process.env.INVOICE_AI_ENDPOINT;
  if (aiEndpoint) {
    const aiResponse = await fetch(aiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.INVOICE_AI_KEY
          ? { Authorization: `Bearer ${process.env.INVOICE_AI_KEY}` }
          : {})
      },
      body: JSON.stringify({
        text,
        filename: file.name
      })
    });

    const aiData = await aiResponse.json();
    if (aiResponse.ok) {
      return NextResponse.json(aiData);
    }
  }

  const invoiceNumber = findFirst(
    [
      /Invoice\s*(?:Number|No\.?|#)?\s*[:#]?\s*([A-Z0-9-]+)/i,
      /Inv\s*#\s*([A-Z0-9-]+)/i
    ],
    text
  );

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const clientEmail = emailMatch ? emailMatch[0] : null;

  const clientName = findFirst(
    [
      /Bill To\s*[:]?\s*([A-Za-z0-9 &.,-]{3,})/i,
      /Billed To\s*[:]?\s*([A-Za-z0-9 &.,-]{3,})/i,
      /Customer\s*[:]?\s*([A-Za-z0-9 &.,-]{3,})/i
    ],
    text
  );

  const totalRaw = findFirst(
    [/(?:Total|Amount Due|Balance Due)\s*[:$]?\s*([0-9,]+(?:\.[0-9]{2})?)/i],
    text
  );
  const currencyMatch = text.match(/\b(USD|EUR|GBP|INR|CAD|AUD)\b/i);
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : "USD";

  const dueRaw = findFirst([
    /Due Date\s*[:]?\s*([A-Za-z0-9,\/\- ]{6,})/i,
    /Due\s*[:]?\s*([A-Za-z0-9,\/\- ]{6,})/i
  ], text);

  const issueRaw = findFirst([
    /Invoice Date\s*[:]?\s*([A-Za-z0-9,\/\- ]{6,})/i,
    /Date\s*[:]?\s*([A-Za-z0-9,\/\- ]{6,})/i
  ], text);

  const amount = totalRaw ? Number(totalRaw.replace(/,/g, "")) : null;
  const dueDate = parseDateValue(dueRaw || undefined);
  const issueDate = parseDateValue(issueRaw || undefined);

  return NextResponse.json({
    invoice_number: invoiceNumber || "",
    client_email: clientEmail || "",
    client_name: clientName || "",
    amount: amount || "",
    currency,
    issue_date: issueDate ? issueDate.toISOString().slice(0, 10) : "",
    due_date: dueDate ? dueDate.toISOString().slice(0, 10) : ""
  });
}
