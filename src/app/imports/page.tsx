import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ImportForm } from "@/components/import-form";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import invoices</h1>
        <p className="text-sm text-slate-600">
          Upload a CSV export to quickly load invoices.
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
