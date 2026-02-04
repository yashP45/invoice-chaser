import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ReminderVariants } from "@/components/reminder-variants";

export const dynamic = "force-dynamic";

export default async function ReminderVariantsPage({
  searchParams
}: {
  searchParams: { invoice?: string };
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  if (!searchParams.invoice) {
    return (
      <div className="card p-6">
        <p className="text-sm text-slate-600">Provide an invoice id to generate variants.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reminder variants</h1>
        <p className="text-sm text-slate-600">Generate AI-powered subject/body options.</p>
      </div>
      <ReminderVariants invoiceId={searchParams.invoice} />
    </div>
  );
}
