"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { validateTemplate } from "@/lib/email/template-schema";
import { BUILTIN_TOKEN_KEYS } from "@/lib/email/templates";

export async function updateInvoiceStatus(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const invoiceId = String(formData.get("invoice_id"));
  const status = String(formData.get("status"));
  const paidAt = status === "paid" ? new Date().toISOString() : null;

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("invoices")
    .update({ status, paid_at: paidAt })
    .eq("id", invoiceId)
    .eq("user_id", user.id);

  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function updateClientEmail(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const clientId = String(formData.get("client_id"));
  const email = String(formData.get("email"));

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("clients")
    .update({ email })
    .eq("id", clientId)
    .eq("user_id", user.id);

  revalidatePath("/clients");
}

export async function createClient(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!name || !email) return;

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("clients")
    .upsert(
      { user_id: user.id, name, email },
      { onConflict: "user_id,email" }
    );

  revalidatePath("/clients");
}

export async function updateUserSettings(
  formData: FormData
): Promise<void | { error: string }> {
  const user = await getUser();
  if (!user) return;

  const companyName = String(formData.get("company_name") || "");
  const senderName = String(formData.get("sender_name") || "");
  const replyTo = String(formData.get("reply_to") || "");

  let reminderSubject: string;
  let reminderBody: string;
  const templateJson = formData.get("reminder_template");
  if (templateJson && typeof templateJson === "string" && templateJson.trim() !== "") {
    try {
      const parsed = JSON.parse(templateJson) as { subject?: string; body?: string };
      reminderSubject = typeof parsed.subject === "string" ? parsed.subject : "";
      reminderBody = typeof parsed.body === "string" ? parsed.body : "";
    } catch {
      reminderSubject = String(formData.get("reminder_subject") || "");
      reminderBody = String(formData.get("reminder_body") || "");
    }
  } else {
    reminderSubject = String(formData.get("reminder_subject") || "");
    reminderBody = String(formData.get("reminder_body") || "");
  }

  const unknownTokensInSubject = validateTemplate(reminderSubject, BUILTIN_TOKEN_KEYS, []);
  const unknownTokensInBody = validateTemplate(reminderBody, BUILTIN_TOKEN_KEYS, []);
  if (unknownTokensInSubject.length > 0 || unknownTokensInBody.length > 0) {
    console.warn("Unknown template tokens detected:", {
      subject: unknownTokensInSubject,
      body: unknownTokensInBody
    });
  }

  const admin = createAdminSupabaseClient();
  const updatePayload: Record<string, unknown> = {
    company_name: companyName || null,
    sender_name: senderName || null,
    reply_to: replyTo || null,
    reminder_subject: reminderSubject,
    reminder_body: reminderBody
  };

  const { error } = await admin.from("users").update(updatePayload).eq("id", user.id);

  if (error) {
    console.error("updateUserSettings failed:", error.message);
    return { error: error.message };
  }

  revalidatePath("/settings");
}

export async function deleteInvoice(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const invoiceId = String(formData.get("invoice_id"));
  const supabase = await createServerSupabaseClient();
  await supabase.from("invoices").delete().eq("id", invoiceId).eq("user_id", user.id);

  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function deleteClient(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const clientId = String(formData.get("client_id"));
  const supabase = await createServerSupabaseClient();
  await supabase.from("clients").delete().eq("id", clientId).eq("user_id", user.id);

  revalidatePath("/clients");
  revalidatePath("/");
}

export async function deleteReminder(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const reminderId = String(formData.get("reminder_id"));
  const supabase = await createServerSupabaseClient();
  await supabase.from("reminders").delete().eq("id", reminderId).eq("user_id", user.id);

  revalidatePath("/reminders");
}
