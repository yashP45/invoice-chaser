import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import { Landing } from "@/components/landing";
import { reminderStage } from "@/lib/reminders";
import {
  getSuggestedAction,
  getReminderEffectiveness,
  getEffectivenessWindowStart
} from "@/lib/insights/dashboard";
import { DashboardSummary } from "@/components/dashboard-summary";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) {
    return <Landing />;
  }

  const supabase = await createServerSupabaseClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, due_date, status, last_reminder_sent_at, paid_at, clients(name, email)"
    )
    .eq("user_id", user.id);

  const overdueInvoices = (invoices || []).filter((invoice) => {
    const overdue = daysOverdue(invoice.due_date);
    return overdue > 0 && (invoice.status === "open" || invoice.status === "partial");
  });

  const overdueAmount = overdueInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0
  );

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const { data: allReminders } = await supabase
    .from("reminders")
    .select("id, sent_at, invoice_id, reminder_stage")
    .eq("user_id", user.id);

  const reminders = (allReminders || []).filter(
    (r) => new Date(r.sent_at) >= startOfWeek
  );

  const effectivenessStart = getEffectivenessWindowStart();
  const { data: remindersLast30 } = await supabase
    .from("reminders")
    .select("invoice_id, sent_at")
    .eq("user_id", user.id)
    .gte("sent_at", effectivenessStart.toISOString());

  const suggestedAction = getSuggestedAction(
    invoices || [],
    allReminders || []
  );
  const invoicesById = new Map(
    (invoices || []).map((inv) => [
      inv.id,
      { id: inv.id, status: inv.status, paid_at: inv.paid_at ?? null }
    ])
  );
  const effectiveness = getReminderEffectiveness(
    remindersLast30 || [],
    invoicesById
  );

  const sentMap = new Set(
    (allReminders || []).map((r) => `${r.invoice_id}:${r.reminder_stage}`)
  );
  const eligibleCount = overdueInvoices.filter((inv) => {
    const overdue = daysOverdue(inv.due_date);
    const stage = reminderStage(overdue);
    if (stage === 0) return false;
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    return !sentMap.has(`${inv.id}:${stage}`) && !!client?.email;
  }).length;
  const topOverdueForSummary = overdueInvoices.slice(0, 5).map((inv) => {
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    return {
      invoice_number: inv.invoice_number,
      client_name: client?.name ?? "—",
      days_overdue: daysOverdue(inv.due_date),
      amount: Number(inv.amount || 0),
      currency: inv.currency || "USD"
    };
  });
  const summaryPayload = {
    overdueCount: overdueInvoices.length,
    overdueAmount,
    remindersThisWeek: reminders.length,
    eligibleForReminder: eligibleCount,
    suggestedActionText: suggestedAction.suggestedAction,
    effectivenessLabel: effectiveness.label,
    topOverdue: topOverdueForSummary,
    expectedInflow: overdueAmount
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="space-y-3 sm:space-y-4">
        <span className="inline-flex items-center rounded-full border border-slate-200/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Overview
        </span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold mb-1">Dashboard</h1>
          <p className="text-sm sm:text-base text-slate-600">
            Track overdue invoices and send reminders in one place.
          </p>
        </div>
      </section>

      <DashboardSummary payload={summaryPayload} />

      <section className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Overdue invoices
          </p>
          <p className="text-2xl sm:text-3xl font-semibold mb-1">{overdueInvoices.length}</p>
          <p className="text-xs text-slate-500">Active invoices past due.</p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Overdue amount
          </p>
          <p className="text-2xl sm:text-3xl font-semibold mb-1">
            ${overdueAmount.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">Total outstanding balance.</p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Reminders sent
          </p>
          <p className="text-2xl sm:text-3xl font-semibold mb-1">{reminders.length}</p>
          <p className="text-xs text-slate-500">Sent since Sunday.</p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Reminder effectiveness
          </p>
          <p className="text-sm font-medium text-slate-900 mb-1">{effectiveness.label}</p>
          <p className="text-xs text-slate-500">Last 30 days.</p>
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">Quick actions</h2>
            <p className="text-xs text-slate-500">
              Jump straight into adding or importing invoices.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link className="button text-xs sm:text-sm px-3 sm:px-4" href="/invoices/new">
              Add invoice
            </Link>
            <Link className="button-secondary text-xs sm:text-sm px-3 sm:px-4" href="/imports">
              Import CSV
            </Link>
            <Link className="button-secondary text-xs sm:text-sm px-3 sm:px-4" href="/reminders">
              View reminders
            </Link>
          </div>
        </div>
        {suggestedAction.suggestedAction && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-2">Suggested</p>
            <p className="text-sm text-slate-600 mb-2">{suggestedAction.suggestedAction}</p>
            <Link
              className="button-secondary text-xs sm:text-sm"
              href={suggestedAction.invoiceId ? "/invoices" : "/reminders"}
            >
              {suggestedAction.invoiceId ? "Send reminder" : "Run reminders"}
            </Link>
          </div>
        )}
      </section>

      <section className="card p-4 sm:p-6">
        <div className="mb-4 sm:mb-5">
          <h2 className="text-lg font-semibold mb-1">Overdue right now</h2>
          <p className="text-xs text-slate-500">
            Top overdue invoices for quick follow up.
          </p>
        </div>
        {overdueInvoices.length === 0 ? (
          <p className="text-sm text-slate-600">No overdue invoices.</p>
        ) : (
          <>
            {/* Card view for small screens */}
            <div className="space-y-4 lg:hidden">
              {overdueInvoices.slice(0, 5).map((invoice) => {
                const client = Array.isArray(invoice.clients)
                  ? invoice.clients[0]
                  : invoice.clients;
                return (
                  <div
                    key={invoice.id}
                    className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-base mb-1">
                          {invoice.invoice_number}
                        </h3>
                        <p className="text-sm text-slate-600">{client?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-slate-900">
                          ${Number(invoice.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-slate-100">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Due date</p>
                        <p className="font-medium text-slate-900">
                          {formatDate(invoice.due_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Days overdue</p>
                        <p className="font-medium text-slate-900">
                          {daysOverdue(invoice.due_date)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table view for large screens */}
            <div className="hidden lg:block table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Due date</th>
                    <th>Days overdue</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueInvoices.slice(0, 5).map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoice_number}</td>
                      <td>
                        {(Array.isArray(invoice.clients)
                          ? invoice.clients[0]
                          : invoice.clients)?.name}
                      </td>
                      <td>{formatDate(invoice.due_date)}</td>
                      <td>{daysOverdue(invoice.due_date)}</td>
                      <td>${Number(invoice.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
