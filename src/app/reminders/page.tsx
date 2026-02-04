import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";
import { ReminderStatusBadge } from "@/components/reminder-status-badge";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();
  const { data: reminders } = await supabase
    .from("reminders")
    .select(
      "id, reminder_stage, sent_at, status, invoices(invoice_number, clients(name))"
    )
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reminders log</h1>
        <p className="text-sm text-slate-600">
          Track reminders sent and their status.
        </p>
      </div>
      <div className="card p-6">
        {reminders && reminders.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Stage</th>
                <th>Sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((reminder) => (
                <tr key={reminder.id}>
                  <td>{reminder.invoices?.invoice_number}</td>
                  <td>{reminder.invoices?.clients?.name}</td>
                  <td>Stage {reminder.reminder_stage}</td>
                  <td>{reminder.sent_at ? formatDate(reminder.sent_at) : "-"}</td>
                  <td>
                    <ReminderStatusBadge status={reminder.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">No reminders yet</p>
            <p className="text-sm text-slate-500">
              Run the reminder engine to send follow-ups for overdue invoices.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
