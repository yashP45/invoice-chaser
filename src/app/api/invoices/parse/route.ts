import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { invoiceExtractionSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

type AiInvoicePayload = {
  client_name?: string;
  client_email?: string;
  client_address?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  payment_terms?: string;
  currency?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  line_items?: Array<{
    description?: string;
    quantity?: number;
    unit_price?: number;
    line_total?: number;
  }>;
  confidence?: number;
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

async function extractPdfText(buffer: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: buffer, disableWorker: true });
  const pdf = await loadingTask.promise;
  let output = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    output += `${pageText} `;
  }
  return output.trim();
}

async function parseWithOpenAI(file: File) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const isImage = file.type.startsWith("image/");
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  let fileId: string | null = null;
  let imageUrl: string | null = null;

  if (isImage) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    imageUrl = `data:${file.type};base64,${base64}`;
  } else if (isPdf) {
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
    fileId = uploadData.id;
  } else {
    return null;
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
          name: invoiceExtractionSchema.name,
          schema: invoiceExtractionSchema.schema,
          strict: invoiceExtractionSchema.strict
        }
      },
      input: [
        {
          role: "user",
          content: [
            ...(fileId ? [{ type: "input_file", file_id: fileId }] : []),
            ...(imageUrl ? [{ type: "input_image", image_url: imageUrl }] : []),
            {
              type: "input_text",
              text: [
                "Extract invoice data. Return JSON that matches the schema.",
                "Use ISO date format YYYY-MM-DD.",
                "If a field is missing, return empty string or null.",
                "Line items should include description, quantity, unit_price, line_total.",
                "Confidence should be 0-1."
              ].join(" ")
            }
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
  if (!outputText) return null;
  return JSON.parse(outputText);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "PDF or image file required" }, { status: 400 });
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");

  const maxSizeMb = Number(process.env.MAX_UPLOAD_MB || 20);
  if (file.size > maxSizeMb * 1024 * 1024) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  await admin.from("users").upsert({ id: user.id, email: user.email });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "invoice_uploads";
  const tempPath = `${user.id}/temp/${crypto.randomUUID()}/${file.name}`;
  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(tempPath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  let aiPayload: AiInvoicePayload | null = null;
  let aiError: string | null = null;
  try {
    aiPayload = await parseWithOpenAI(file);
  } catch (error) {
    aiError = error instanceof Error ? error.message : "AI extraction failed";
  }

  if (aiPayload) {
    return NextResponse.json({
      ...aiPayload,
      ai_extracted: true,
      ai_confidence: aiPayload.confidence ?? null,
      file_path: tempPath
    });
  }

  if (!isPdf) {
    return NextResponse.json(
      {
        error:
          "AI extraction failed and fallback parsing is only available for PDFs.",
        file_path: tempPath
      },
      { status: 400 }
    );
  }

  let text = "";
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const parsed = await extractPdfText(buffer);
    text = parsed.replace(/\s+/g, " ").trim();
  } catch (error) {
    return NextResponse.json(
      {
        error: aiError
          ? `AI extraction failed: ${aiError}. PDF text extraction also failed.`
          : "Unable to read PDF text. Please try another file.",
        file_path: tempPath
      },
      { status: 400 }
    );
  }

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
    total: amount || null,
    currency,
    invoice_date: issueDate ? issueDate.toISOString().slice(0, 10) : "",
    due_date: dueDate ? dueDate.toISOString().slice(0, 10) : "",
    ai_extracted: false,
    ai_confidence: null,
    file_path: tempPath
  });
}
