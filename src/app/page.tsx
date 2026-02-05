import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import { Landing } from "@/components/landing";

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
      "id, invoice_number, amount, currency, due_date, status, clients(name)"
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

  const { data: reminders } = await supabase
    .from("reminders")
    .select("id, sent_at")
    .eq("user_id", user.id)
    .gte("sent_at", startOfWeek.toISOString());

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

      <section className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <p className="text-xs text-slate-500">
              Jump straight into adding or importing invoices.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button" href="/invoices/new">
              Add invoice
            </Link>
            <Link className="button-secondary" href="/imports">
              Import CSV
            </Link>
            <Link className="button-secondary" href="/reminders">
              View reminders
            </Link>
          </div>
        </div>
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
