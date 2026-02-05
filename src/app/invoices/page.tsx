import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import Link from "next/link";
import { deleteInvoice, updateInvoiceStatus } from "@/lib/actions";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LoadingButton } from "@/components/loading-button";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, due_date, status, ai_extracted, ai_confidence, source_file_path, clients(name)"
    )
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-slate-600">Track status and days overdue.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="button" href="/invoices/new">
            Add invoice
          </Link>
          <Link className="button-secondary" href="/imports">
            Import CSV
          </Link>
        </div>
      </div>

      <div className="card p-6">
        {invoices && invoices.length > 0 ? (
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
                        AI {invoice.ai_confidence ? `· ${Math.round(invoice.ai_confidence * 100)}%` : ""}
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
                    <form action={updateInvoiceStatus} className="flex gap-2">
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <LoadingButton
                        className="button-secondary"
                        pendingText="Updating..."
                        name="status"
                        value="open"
                      >
                        Open
                      </LoadingButton>
                      <LoadingButton
                        className="button-secondary"
                        pendingText="Updating..."
                        name="status"
                        value="partial"
                      >
                        Partial
                      </LoadingButton>
                      <LoadingButton
                        className="button-secondary"
                        pendingText="Updating..."
                        name="status"
                        value="paid"
                      >
                        Paid
                      </LoadingButton>
                    </form>
                  </td>
                  <td>
                    <ConfirmDialog
                      title={`Delete invoice ${invoice.invoice_number}?`}
                      description="This will remove the invoice and its reminder history."
                      triggerLabel="Delete"
                      confirmLabel="Delete invoice"
                      triggerClassName="button-danger"
                      formAction={deleteInvoice}
                      hiddenFields={{ invoice_id: invoice.id }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
