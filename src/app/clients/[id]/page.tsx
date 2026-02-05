import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

type TimelineEvent = {
  id: string;
  type: "invoice" | "reminder";
  title: string;
  subtitle: string;
  date: string;
};

export default async function ClientDetailPage({
  params
}: {
  params: { id: string };
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createServerSupabaseClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) {
    redirect("/clients");
  }

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, due_date, status, created_at")
    .eq("client_id", client.id)
    .order("due_date", { ascending: false });

  const { data: reminders } = await supabase
    .from("reminders")
    .select("id, reminder_stage, sent_at, status, invoices(invoice_number, client_id)")
    .eq("user_id", user.id)
    .eq("invoices.client_id", client.id)
    .order("sent_at", { ascending: false });

  const events: TimelineEvent[] = [];

  (invoices || []).forEach((invoice) => {
    events.push({
      id: invoice.id,
      type: "invoice",
      title: `Invoice ${invoice.invoice_number}`,
      subtitle: `${invoice.currency || "USD"} ${Number(invoice.amount).toFixed(2)} · ${
        invoice.status
      }`,
      date: invoice.created_at || invoice.due_date
    });
  });

  (reminders || []).forEach((reminder) => {
    const invoice =
      Array.isArray(reminder.invoices) ? reminder.invoices[0] : reminder.invoices;
    events.push({
      id: reminder.id,
      type: "reminder",
      title: `Reminder stage ${reminder.reminder_stage}`,
      subtitle: `Invoice ${invoice?.invoice_number || ""} · ${reminder.status}`,
      date: reminder.sent_at || new Date().toISOString()
    });
  });

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Client</p>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <p className="text-sm text-slate-600">{client.email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Invoices</p>
          <p className="text-2xl font-semibold">{invoices?.length || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Open balance</p>
          <p className="text-2xl font-semibold">
            ${
              (invoices || [])
                .filter((inv) => inv.status !== "paid")
                .reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
                .toFixed(2)
            }
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Reminders sent</p>
          <p className="text-2xl font-semibold">{reminders?.length || 0}</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <p className="text-xs text-slate-500">
          Invoice history and reminder activity.
        </p>

        <div className="mt-4 space-y-4">
          {events.length === 0 ? (
            <p className="text-sm text-slate-600">No activity yet.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="flex gap-4">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{event.title}</p>
                  <p className="text-xs text-slate-500">{event.subtitle}</p>
                  <p className="text-xs text-slate-400">{formatDate(event.date)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
