import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import { ImportForm } from "@/components/import-form";
import { RunReminders } from "@/components/run-reminders";
import { Landing } from "@/components/landing";
import { AnalyticsCharts } from "@/components/analytics-chart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) {
    return <Landing />;
  }

  const supabase = createServerSupabaseClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, due_date, status, paid_at, issue_date, clients(name)"
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

  const paidInvoices = (invoices || []).filter(
    (invoice) => invoice.status === "paid" && invoice.paid_at
  );

  const paidLast30 = paidInvoices.filter((invoice) => {
    const paidAt = new Date(invoice.paid_at as string);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return paidAt >= cutoff;
  });

  const avgDaysLate = paidInvoices.length
    ? Math.round(
        paidInvoices.reduce((sum, invoice) => {
          const paidAt = new Date(invoice.paid_at as string);
          const dueDate = new Date(invoice.due_date);
          const diffDays = Math.floor(
            (paidAt.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + Math.max(diffDays, 0);
        }, 0) / paidInvoices.length
      )
    : null;

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const { data: reminders } = await supabase
    .from("reminders")
    .select("id, sent_at")
    .eq("user_id", user.id)
    .gte("sent_at", startOfWeek.toISOString());

  const totalOutstanding = (invoices || [])
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  const collectionRate = invoices?.length
    ? Math.round(
        (paidInvoices.length / (invoices?.length || 1)) * 100
      )
    : 0;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const cashflowThisMonth = paidInvoices
    .filter((invoice) => {
      const paidAt = new Date(invoice.paid_at as string);
      return paidAt.getMonth() === currentMonth && paidAt.getFullYear() === currentYear;
    })
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  const cashflowLastMonth = paidInvoices
    .filter((invoice) => {
      const paidAt = new Date(invoice.paid_at as string);
      return paidAt.getMonth() === lastMonth && paidAt.getFullYear() === lastMonthYear;
    })
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  const cashflowTrend = cashflowLastMonth
    ? Math.round(((cashflowThisMonth - cashflowLastMonth) / cashflowLastMonth) * 100)
    : null;

  const cashflowChart = Array.from({ length: 6 }).map((_, idx) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - idx));
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const total = paidInvoices
      .filter((invoice) => {
        const paidAt = new Date(invoice.paid_at as string);
        return (
          paidAt.getMonth() === date.getMonth() &&
          paidAt.getFullYear() === date.getFullYear()
        );
      })
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    return { month, total: Number(total.toFixed(2)) };
  });

  const { data: slowestClients } = await supabase
    .from("invoices")
    .select("id, due_date, paid_at, clients(name)")
    .eq("user_id", user.id)
    .not("paid_at", "is", null);

  const slowestMap = new Map<string, { name: string; totalDays: number; count: number }>();
  (slowestClients || []).forEach((invoice) => {
    const client =
      Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
    if (!client?.name) return;
    const paidAt = new Date(invoice.paid_at as string);
    const dueDate = new Date(invoice.due_date);
    const diff = Math.max(
      0,
      Math.floor((paidAt.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const existing = slowestMap.get(client.name) || {
      name: client.name,
      totalDays: 0,
      count: 0
    };
    existing.totalDays += diff;
    existing.count += 1;
    slowestMap.set(client.name, existing);
  });

  const slowestChart = Array.from(slowestMap.values())
    .map((entry) => ({
      name: entry.name,
      avg_days_late: Math.round(entry.totalDays / entry.count)
    }))
    .sort((a, b) => b.avg_days_late - a.avg_days_late)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <span className="inline-flex items-center rounded-full border border-slate-200/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Overview
        </span>
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-slate-600">
            Track overdue invoices and send reminders in one place.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Overdue invoices
          </p>
          <p className="text-3xl font-semibold">{overdueInvoices.length}</p>
          <p className="text-xs text-slate-500">Active invoices past due.</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Overdue amount
          </p>
          <p className="text-3xl font-semibold">
            ${overdueAmount.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">Total outstanding balance.</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Reminders sent
          </p>
          <p className="text-3xl font-semibold">{reminders?.length || 0}</p>
          <p className="text-xs text-slate-500">Sent since Sunday.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Paid in last 30 days
          </p>
          <p className="text-3xl font-semibold">
            $
            {paidLast30
              .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
              .toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">Cash collected recently.</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Avg days late
          </p>
          <p className="text-3xl font-semibold">{avgDaysLate ?? "-"}</p>
          <p className="text-xs text-slate-500">Across paid invoices.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Outstanding balance
          </p>
          <p className="text-3xl font-semibold">${totalOutstanding.toFixed(2)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Cash flow change
          </p>
          <p className="text-3xl font-semibold">
            {cashflowTrend === null ? "-" : `${cashflowTrend}%`}
          </p>
          <p className="text-xs text-slate-500">
            This month vs last month.
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Collection effectiveness
          </p>
          <p className="text-3xl font-semibold">{collectionRate}%</p>
          <p className="text-xs text-slate-500">Paid invoices / total.</p>
        </div>
      </section>

      <AnalyticsCharts cashflow={cashflowChart} slowest={slowestChart} />

      <section className="grid gap-6 md:grid-cols-2">
        <ImportForm />
        <RunReminders />
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Overdue right now</h2>
            <p className="text-xs text-slate-500">
              Top overdue invoices for quick follow up.
            </p>
          </div>
        </div>
        {overdueInvoices.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No overdue invoices.</p>
        ) : (
          <table className="table mt-3">
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
        )}
      </section>
    </div>
  );
}
