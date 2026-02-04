import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { updateClientEmail } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
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
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-slate-600">
          Keep client contact emails up to date.
        </p>
      </div>
      <div className="card p-6">
        {clients && clients.length > 0 ? (
          <div className="space-y-4">
            {clients.map((client) => (
              <form
                key={client.id}
                action={updateClientEmail}
                className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:gap-4"
              >
                <input type="hidden" name="client_id" value={client.id} />
                <div className="md:w-1/3 font-semibold text-slate-700">
                  {client.name}
                  <Link
                    href={`/clients/${client.id}`}
                    className="ml-2 text-xs font-semibold text-slate-500 underline"
                  >
                    View timeline
                  </Link>
                </div>
                <input
                  className="input md:w-1/2"
                  type="email"
                  name="email"
                  defaultValue={client.email}
                  required
                />
                <button className="button-secondary" type="submit">
                  Save
                </button>
              </form>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">No clients yet</p>
            <p className="text-sm text-slate-500">
              Upload invoices to automatically create your client list.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
