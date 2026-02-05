import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";
import { deleteReminder } from "@/lib/actions";
import { ReminderStatusBadge } from "@/components/reminder-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RunReminders } from "@/components/run-reminders";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

export default async function RemindersPage({
  searchParams
}: {
  searchParams?: { page?: string };
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const pageSize = 10;
  const page = Math.max(1, Number(searchParams?.page || 1));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createServerSupabaseClient();
  const { data: reminders, count } = await supabase
    .from("reminders")
    .select(
      "id, reminder_stage, sent_at, status, invoices(id, invoice_number, clients(name))",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .range(from, to);

  const { data: lastReminder } = await supabase
    .from("reminders")
    .select("sent_at")
    .eq("user_id", user.id)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cronIntervalHours = Number(process.env.REMINDER_CRON_INTERVAL_HOURS || 24);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reminders log</h1>
        <p className="text-sm text-slate-600">
          Track reminders sent and their status.
        </p>
      </div>
      <RunReminders
        lastRunAt={lastReminder?.sent_at || null}
        cronIntervalHours={Number.isFinite(cronIntervalHours) ? cronIntervalHours : 24}
      />
      <div className="card p-6">
        {reminders && reminders.length > 0 ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Stage</th>
                  <th>Sent</th>
                  <th>Status</th>
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
                      {(() => {
                        const invoice = Array.isArray(reminder.invoices)
                          ? reminder.invoices[0]
                          : reminder.invoices;
                        const client = Array.isArray(invoice?.clients)
                          ? invoice?.clients[0]
                          : invoice?.clients;
                        return client?.name || "—";
                      })()}
                    </td>
                    <td>Stage {reminder.reminder_stage}</td>
                    <td>{reminder.sent_at ? formatDate(reminder.sent_at) : "-"}</td>
                    <td>
                      <ReminderStatusBadge status={reminder.status} />
                    </td>
                    <td>
                    <ConfirmDialog
                      title="Delete this reminder log entry?"
                      description="This will remove the reminder history item."
                      triggerLabel="Delete"
                      confirmLabel="Delete reminder"
                      triggerClassName="button-danger-sm"
                      formAction={deleteReminder}
                      hiddenFields={{ reminder_id: reminder.id }}
                    />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={count || 0}
              basePath="/reminders"
              searchParams={searchParams}
            />
          </>
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
