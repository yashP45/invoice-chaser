import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { InvoiceCreateForm } from "@/components/invoice-create-form";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params
}: {
  params: { id: string };
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, client_id, invoice_number, amount, currency, issue_date, due_date, status, subtotal, tax, total, payment_terms, bill_to_address, ai_extracted, ai_confidence, source_file_path, clients(name,email)"
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!invoice) {
    redirect("/invoices");
  }

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("description, quantity, unit_price, line_total, position")
    .eq("invoice_id", invoice.id)
    .order("position", { ascending: true });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("user_id", user.id)
    .order("name");

  const client =
    Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edit invoice</h1>
          <p className="text-sm text-slate-600">
            Update details and line items.
          </p>
        </div>
        <Link className="button-secondary" href="/invoices">
          Back to invoices
        </Link>
      </div>

      <InvoiceCreateForm
        clients={clients || []}
        mode="edit"
        invoiceId={invoice.id}
        initialData={{
          client_id: invoice.client_id,
          client_name: client?.name || "",
          client_email: client?.email || "",
          invoice_number: invoice.invoice_number,
          amount: invoice.amount,
          currency: invoice.currency,
          issue_date: invoice.issue_date || "",
          due_date: invoice.due_date || "",
          status: invoice.status,
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          total: invoice.total,
          payment_terms: invoice.payment_terms,
          bill_to_address: invoice.bill_to_address,
          ai_extracted: invoice.ai_extracted,
          ai_confidence: invoice.ai_confidence,
          source_file_path: invoice.source_file_path,
          line_items: lineItems || []
        }}
      />
    </div>
  );
}
