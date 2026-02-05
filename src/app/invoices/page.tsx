import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import Link from "next/link";
import { deleteInvoice, updateInvoiceStatus } from "@/lib/actions";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LoadingButton } from "@/components/loading-button";
import { SendReminderButton } from "@/components/send-reminder-button";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";


export default async function InvoicesPage({
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
  const { data: invoices, count } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, due_date, status, ai_extracted, ai_confidence, source_file_path, clients(name)",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("due_date", { ascending: true })
    .range(from, to);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold mb-1">Invoices</h1>
          <p className="text-sm text-slate-600">Track status and days overdue.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Link className="button text-xs sm:text-sm px-3 sm:px-4" href="/invoices/new">
            Add invoice
          </Link>
          <Link className="button-secondary text-xs sm:text-sm px-3 sm:px-4" href="/imports">
            Import CSV
          </Link>
        </div>
      </div>

      <div className="card p-4 sm:p-6 lg:p-6">
        {invoices && invoices.length > 0 ? (
          <>
            {/* Card view for small screens */}
            <div className="space-y-4 lg:hidden">
              {invoices.map((invoice) => {
                const client = Array.isArray(invoice.clients)
                  ? invoice.clients[0]
                  : invoice.clients;
                return (
                  <div
                    key={invoice.id}
                    className="border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-base mb-1">{invoice.invoice_number}</h3>
                        <p className="text-sm text-slate-600">{client?.name}</p>
                      </div>
                      <StatusBadge status={invoice.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Due date</p>
                        <p className="font-medium text-slate-900">{formatDate(invoice.due_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Days overdue</p>
                        <p className="font-medium text-slate-900">{daysOverdue(invoice.due_date)}</p>
                      </div>
                    </div>
                    {(invoice.ai_extracted || invoice.source_file_path) && (
                      <div className="flex flex-wrap items-center gap-3">
                        {invoice.ai_extracted && (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            AI{invoice.ai_confidence ? ` · ${Math.round(invoice.ai_confidence * 100)}%` : ""}
                          </span>
                        )}
                        {invoice.source_file_path && (
                          <a
                            href={`/api/invoices/file?path=${encodeURIComponent(
                              invoice.source_file_path
                            )}`}
                            className="text-xs font-semibold text-slate-500 underline hover:text-slate-700"
                          >
                            View file
                          </a>
                        )}
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-200 space-y-3">
                      <form action={updateInvoiceStatus} className="w-full">
                        <input type="hidden" name="invoice_id" value={invoice.id} />
                        <div className="flex gap-2">
                          <select
                            name="status"
                            defaultValue={invoice.status}
                            className="input-sm text-xs flex-1"
                          >
                            <option value="open">Open</option>
                            <option value="partial">Partial</option>
                            <option value="paid">Paid</option>
                            <option value="void">Void</option>
                          </select>
                          <LoadingButton className="button-secondary-sm text-xs whitespace-nowrap" pendingText="...">
                            Update
                          </LoadingButton>
                        </div>
                      </form>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="button-secondary-sm text-xs flex-1 min-w-[80px]"
                          href={`/invoices/${invoice.id}/edit`}
                        >
                          Edit
                        </Link>
                        <SendReminderButton
                          invoiceId={invoice.id}
                          className="button-secondary-sm text-xs flex-1 min-w-[80px]"
                          label="Remind"
                          disabled={
                            !(
                              invoice.status === "open" ||
                              invoice.status === "partial"
                            ) || daysOverdue(invoice.due_date) <= 0
                          }
                        />
                        <ConfirmDialog
                          title={`Delete invoice ${invoice.invoice_number}?`}
                          description="This will remove the invoice and its reminder history."
                          triggerLabel="Delete"
                          confirmLabel="Delete invoice"
                          triggerClassName="button-danger-sm text-xs flex-1 min-w-[80px]"
                          formAction={deleteInvoice}
                          hiddenFields={{ invoice_id: invoice.id }}
                        />
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
                    <th>Status</th>
                    <th>AI</th>
                    <th>File</th>
                    <th>Update</th>
                    <th>Edit</th>
                    <th>Reminder</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoice_number}</td>
                      <td>
                        {(Array.isArray(invoice.clients)
                          ? invoice.clients[0]
                          : invoice.clients)?.name}
                      </td>
                      <td>{formatDate(invoice.due_date)}</td>
                      <td>{daysOverdue(invoice.due_date)}</td>
                      <td>
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td>
                        {invoice.ai_extracted ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            AI{" "}
                            {invoice.ai_confidence
                              ? `· ${Math.round(invoice.ai_confidence * 100)}%`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td>
                        {invoice.source_file_path ? (
                          <a
                            href={`/api/invoices/file?path=${encodeURIComponent(
                              invoice.source_file_path
                            )}`}
                            className="text-xs font-semibold text-slate-500 underline"
                          >
                            View file
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td>
                        <form action={updateInvoiceStatus} className="flex items-center gap-2">
                          <input type="hidden" name="invoice_id" value={invoice.id} />
                          <select
                            name="status"
                            defaultValue={invoice.status}
                            className="input-sm text-xs min-w-[80px]"
                          >
                            <option value="open">Open</option>
                            <option value="partial">Partial</option>
                            <option value="paid">Paid</option>
                            <option value="void">Void</option>
                          </select>
                          <LoadingButton className="button-secondary-sm text-xs whitespace-nowrap" pendingText="Updating...">
                            Update
                          </LoadingButton>
                        </form>
                      </td>
                      <td>
                        <Link className="button-secondary-sm" href={`/invoices/${invoice.id}/edit`}>
                          Edit
                        </Link>
                      </td>
                      <td>
                        <SendReminderButton
                          invoiceId={invoice.id}
                          className="button-secondary-sm"
                          label="Send"
                          disabled={
                            !(
                              invoice.status === "open" ||
                              invoice.status === "partial"
                            ) || daysOverdue(invoice.due_date) <= 0
                          }
                        />
                      </td>
                      <td>
                        <ConfirmDialog
                          title={`Delete invoice ${invoice.invoice_number}?`}
                          description="This will remove the invoice and its reminder history."
                          triggerLabel="Delete"
                          confirmLabel="Delete invoice"
                          triggerClassName="button-danger-sm"
                          formAction={deleteInvoice}
                          hiddenFields={{ invoice_id: invoice.id }}
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
              basePath="/invoices"
              searchParams={resolvedSearchParams}
            />
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">No invoices yet</p>
            <p className="text-sm text-slate-500">
              Import a CSV or add an invoice manually to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
