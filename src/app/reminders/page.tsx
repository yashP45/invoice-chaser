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
  searchParams?: Promise<{ page?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const resolvedSearchParams = await searchParams;
  const pageSize = 10;
  const page = Math.max(1, Number(resolvedSearchParams?.page || 1));
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
      <div className="card p-4 sm:p-6">
        {reminders && reminders.length > 0 ? (
          <>
            {/* Card view for small screens */}
            <div className="space-y-4 lg:hidden">
              {reminders.map((reminder) => {
                const invoice = Array.isArray(reminder.invoices)
                  ? reminder.invoices[0]
                  : reminder.invoices;
                const client = Array.isArray(invoice?.clients)
                  ? invoice?.clients[0]
                  : invoice?.clients;
                return (
                  <div
                    key={reminder.id}
                    className="border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-900 text-base mb-1">
                        {invoice?.invoice_number || "—"}
                      </h3>
                      <p className="text-sm text-slate-600">{client?.name || "—"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Stage</p>
                        <p className="font-medium text-slate-900">Stage {reminder.reminder_stage}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Sent</p>
                        <p className="font-medium text-slate-900">
                          {reminder.sent_at ? formatDate(reminder.sent_at) : "-"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <ReminderStatusBadge status={reminder.status} />
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <ConfirmDialog
                        title="Delete this reminder log entry?"
                        description="This will remove the reminder history item."
                        triggerLabel="Delete"
                        confirmLabel="Delete reminder"
                        triggerClassName="button-danger-sm text-xs w-full"
                        formAction={deleteReminder}
                        hiddenFields={{ reminder_id: reminder.id }}
                      />
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
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={count || 0}
              basePath="/reminders"
              searchParams={resolvedSearchParams}
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
