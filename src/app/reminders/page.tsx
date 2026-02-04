import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";
import { deleteReminder } from "@/lib/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { ReminderStatusBadge } from "@/components/reminder-status-badge";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();
  const { data: reminders } = await supabase
    .from("reminders")
    .select(
      "id, reminder_stage, sent_at, status, invoices(id, invoice_number, clients(name))"
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
                <th>AI</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((reminder) => (
                <tr key={reminder.id}>
                  <td>
                    {(Array.isArray(reminder.invoices)
                      ? reminder.invoices[0]
                      : reminder.invoices)?.invoice_number}
                  </td>
                  <td>
                    {(Array.isArray(reminder.invoices)
                      ? reminder.invoices[0]
                      : reminder.invoices)?.clients?.[0]?.name}
                  </td>
                  <td>Stage {reminder.reminder_stage}</td>
                  <td>{reminder.sent_at ? formatDate(reminder.sent_at) : "-"}</td>
                  <td>
                    <ReminderStatusBadge status={reminder.status} />
                  </td>
                  <td>
                    {reminder.invoices && (
                      <a
                        href={`/reminders/variants?invoice=${encodeURIComponent(
                          (Array.isArray(reminder.invoices)
                            ? reminder.invoices[0]
                            : reminder.invoices)?.id || ""
                        )}`}
                        className="text-xs font-semibold text-slate-500 underline"
                      >
                        Variants
                      </a>
                    )}
                  </td>
                  <td>
                    <form className="flex justify-start">
                      <input type="hidden" name="reminder_id" value={reminder.id} />
                      <ConfirmButton
                        formAction={deleteReminder}
                        confirmText="Delete this reminder log entry?"
                        className="button-danger"
                      >
                        Delete
                      </ConfirmButton>
                    </form>
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
