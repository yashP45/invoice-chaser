import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { ReminderVariants } from "@/components/reminder-variants";
import { ReminderVariantPicker } from "@/components/reminder-variant-picker";

export const dynamic = "force-dynamic";

export default async function ReminderVariantsPage({
  searchParams
}: {
  searchParams: { invoice?: string };
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, clients(name)")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reminder variants</h1>
        <p className="text-sm text-slate-600">Generate AI-powered subject/body options.</p>
      </div>
      {!searchParams.invoice ? (
        <ReminderVariantPicker
          invoices={
            (invoices || []).map((invoice) => {
              const client = Array.isArray(invoice.clients)
                ? invoice.clients[0]
                : invoice.clients;
              return {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                client_name: client?.name || null
              };
            }) || []
          }
        />
      ) : (
        <ReminderVariants invoiceId={searchParams.invoice} />
      )}
    </div>
  );
}
