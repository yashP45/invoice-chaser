"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";

export async function updateInvoiceStatus(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const invoiceId = String(formData.get("invoice_id"));
  const status = String(formData.get("status"));
  const paidAt = status === "paid" ? new Date().toISOString() : null;

  const supabase = createServerSupabaseClient();
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

  const supabase = createServerSupabaseClient();
  await supabase
    .from("clients")
    .update({ email })
    .eq("id", clientId)
    .eq("user_id", user.id);

  revalidatePath("/clients");
}

export async function updateUserSettings(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const companyName = String(formData.get("company_name") || "");
  const senderName = String(formData.get("sender_name") || "");
  const replyTo = String(formData.get("reply_to") || "");
  const reminderSubject = String(formData.get("reminder_subject") || "");
  const reminderBody = String(formData.get("reminder_body") || "");

  const admin = createAdminSupabaseClient();
  await admin
    .from("users")
    .update({
      company_name: companyName || null,
      sender_name: senderName || null,
      reply_to: replyTo || null,
      reminder_subject: reminderSubject || null,
      reminder_body: reminderBody || null
    })
    .eq("id", user.id);

  revalidatePath("/settings");
}
