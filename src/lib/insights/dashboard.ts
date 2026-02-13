import { daysOverdue } from "@/lib/utils/date";
import { reminderStage } from "@/lib/reminders";

const EFFECTIVENESS_DAYS = 30;
const PAID_WITHIN_DAYS = 14;

export type SuggestedAction = {
  suggestedAction: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
};

export type ReminderEffectiveness = {
  remindersSent: number;
  paidWithin14Days: number;
  label: string;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  due_date: string;
  status: string;
  clients: { name?: string; email?: string } | { name?: string; email?: string }[] | null;
};

type ReminderRow = {
  invoice_id: string;
  reminder_stage: number;
  sent_at: string;
};

type InvoiceForEffectiveness = {
  id: string;
  status: string;
  paid_at: string | null;
};

export function getSuggestedAction(
  invoices: InvoiceRow[],
  reminders: ReminderRow[]
): SuggestedAction {
  const sentMap = new Set(
    reminders
      .filter((r) => r.sent_at)
      .map((r) => `${r.invoice_id}:${r.reminder_stage}`)
  );

  const eligible = invoices
    .filter((inv) => inv.status === "open" || inv.status === "partial")
    .map((inv) => {
      const overdue = daysOverdue(inv.due_date);
      const stage = reminderStage(overdue);
      const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
      const hasEmail = !!client?.email;
      return { inv, overdue, stage, client, hasEmail };
    })
    .filter(({ overdue, stage, hasEmail }) => stage > 0 && hasEmail)
    .filter(({ inv, stage }) => !sentMap.has(`${inv.id}:${stage}`))
    .sort((a, b) => b.overdue - a.overdue);

  const first = eligible[0];
  if (!first) {
    return { suggestedAction: "", invoiceId: null, invoiceNumber: null };
  }

  const clientName = first.client?.name || "Client";
  const action = `Send reminder to ${clientName} – ${first.inv.invoice_number} is ${first.overdue} days overdue.`;
  return {
    suggestedAction: action,
    invoiceId: first.inv.id,
    invoiceNumber: first.inv.invoice_number
  };
}

export function getReminderEffectiveness(
  remindersLast30: { invoice_id: string; sent_at: string }[],
  invoicesById: Map<string, InvoiceForEffectiveness>
): ReminderEffectiveness {
  const remindersSent = remindersLast30.length;
  const paidWithin14 = new Set<string>();

  for (const r of remindersLast30) {
    const inv = invoicesById.get(r.invoice_id);
    if (!inv || inv.status !== "paid" || !inv.paid_at) continue;
    const sentAt = new Date(r.sent_at).getTime();
    const paidAt = new Date(inv.paid_at).getTime();
    const daysToPay = (paidAt - sentAt) / (24 * 60 * 60 * 1000);
    if (daysToPay >= 0 && daysToPay <= PAID_WITHIN_DAYS) {
      paidWithin14.add(r.invoice_id);
    }
  }

  let label: string;
  if (remindersSent === 0) {
    label = "No reminders sent in the last 30 days.";
  } else {
    label = `${paidWithin14.size} of ${remindersSent} reminders led to payment within 14 days.`;
  }

  return {
    remindersSent,
    paidWithin14Days: paidWithin14.size,
    label
  };
}

export function getEffectivenessWindowStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - EFFECTIVENESS_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}
