import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type AiInvoicePayload = {
  invoice_number?: string;
  client_name?: string;
  client_email?: string;
  amount?: string | number;
  currency?: string;
  issue_date?: string;
  due_date?: string;
};

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

function parseJsonPayload(text: string): AiInvoicePayload | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function parseWithOpenAI(file: File) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const uploadForm = new FormData();
  uploadForm.append("purpose", "user_data");
  uploadForm.append("file", file, file.name);

  const uploadResponse = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: uploadForm
  });

  const uploadData = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(uploadData?.error?.message || "OpenAI file upload failed");
  }

  const prompt = [
    "You are an assistant that extracts invoice data from PDFs.",
    "Return strictly JSON with keys:",
    "invoice_number, client_name, client_email, amount, currency, issue_date, due_date.",
    "Use ISO date format YYYY-MM-DD. If unknown, use empty string.",
    "amount should be a numeric string like \"1250.00\".",
    "Respond with JSON only."
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", file_id: uploadData.id },
            { type: "input_text", text: prompt }
          ]
        }
      ]
    })
  });

  const responseData = await response.json();
  if (!response.ok) {
    throw new Error(responseData?.error?.message || "OpenAI parse failed");
  }

  const outputText = extractResponseText(responseData);
  const payload = parseJsonPayload(outputText);
  return payload;
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

  try {
    const aiPayload = await parseWithOpenAI(file);
    if (aiPayload) {
      return NextResponse.json(aiPayload);
    }
  } catch (error) {
    // Fall back to heuristic parsing below.
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
