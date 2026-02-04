import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { InvoiceCreateForm } from "@/components/invoice-create-form";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("user_id", user.id)
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Add invoice</h1>
          <p className="text-sm text-slate-600">
            Upload a PDF/image or enter invoice details manually.
          </p>
        </div>
        <Link className="button-secondary" href="/invoices">
          Back to invoices
        </Link>
      </div>
      <InvoiceCreateForm clients={clients || []} />
    </div>
  );
}
