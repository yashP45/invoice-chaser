import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { daysOverdue, formatDate } from "@/lib/utils/date";
import { deleteInvoice, updateInvoiceStatus } from "@/lib/actions";
import { StatusBadge } from "@/components/status-badge";
import { InvoiceCreateForm } from "@/components/invoice-create-form";
import { ConfirmButton } from "@/components/confirm-button";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, due_date, status, clients(name)")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("user_id", user.id)
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-slate-600">
          Track status and days overdue.
        </p>
      </div>

      <InvoiceCreateForm clients={clients || []} />

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
                    <form action={updateInvoiceStatus} className="flex gap-2">
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <button className="button-secondary" name="status" value="open">
                        Open
                      </button>
                      <button className="button-secondary" name="status" value="partial">
                        Partial
                      </button>
                      <button className="button-secondary" name="status" value="paid">
                        Paid
                      </button>
                    </form>
                  </td>
                  <td>
                    <form className="flex justify-start">
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <ConfirmButton
                        formAction={deleteInvoice}
                        confirmText={`Delete invoice ${invoice.invoice_number}?`}
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
            <p className="text-sm font-semibold text-slate-700">No invoices yet</p>
            <p className="text-sm text-slate-500">
              Import a CSV on the dashboard to see invoices here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
