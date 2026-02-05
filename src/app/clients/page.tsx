import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import Link from "next/link";
import { deleteClient } from "@/lib/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-slate-600">
            Keep client contact emails up to date.
          </p>
        </div>
        <Link className="button" href="/clients/new">
          Add client
        </Link>
      </div>

      <div className="card p-6">
        {clients && clients.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Email</th>
                <th>Timeline</th>
                <th>Edit</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="font-semibold text-slate-700">{client.name}</td>
                  <td>{client.email}</td>
                  <td>
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-xs font-semibold text-slate-500 underline"
                    >
                      View
                    </Link>
                  </td>
                  <td>
                    <Link className="button-secondary" href={`/clients/${client.id}/edit`}>
                      Edit
                    </Link>
                  </td>
                  <td>
                    <ConfirmDialog
                      title={`Delete ${client.name}?`}
                      description="This will remove the client and all associated invoices."
                      triggerLabel="Delete"
                      confirmLabel="Delete client"
                      triggerClassName="button-danger"
                      formAction={deleteClient}
                      hiddenFields={{ client_id: client.id }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
