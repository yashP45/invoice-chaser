import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import Link from "next/link";
import { deleteClient } from "@/lib/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
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
  const { data: clients, count } = await supabase
    .from("clients")
    .select("id, name, email", { count: "exact" })
    .eq("user_id", user.id)
    .order("name")
    .range(from, to);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-slate-600">
            Keep client contact emails up to date.
          </p>
        </div>
        <Link className="button text-xs sm:text-sm px-3 sm:px-4" href="/clients/new">
          Add client
        </Link>
      </div>

      <div className="card p-4 sm:p-6">
        {clients && clients.length > 0 ? (
          <>
            {/* Card view for small screens */}
            <div className="space-y-4 lg:hidden">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900 text-base mb-1">{client.name}</h3>
                    <p className="text-sm text-slate-600">{client.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
                    <Link
                      href={`/clients/${client.id}`}
                      className="button-secondary-sm text-xs flex-1 min-w-[100px]"
                    >
                      Timeline
                    </Link>
                    <Link
                      className="button-secondary-sm text-xs flex-1 min-w-[100px]"
                      href={`/clients/${client.id}/edit`}
                    >
                      Edit
                    </Link>
                    <ConfirmDialog
                      title={`Delete ${client.name}?`}
                      description="This will remove the client and all associated invoices."
                      triggerLabel="Delete"
                      confirmLabel="Delete client"
                      triggerClassName="button-danger-sm text-xs flex-1 min-w-[100px]"
                      formAction={deleteClient}
                      hiddenFields={{ client_id: client.id }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Table view for large screens */}
            <div className="hidden lg:block table-wrapper">
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
                        <Link className="button-secondary-sm" href={`/clients/${client.id}/edit`}>
                          Edit
                        </Link>
                      </td>
                      <td>
                        <ConfirmDialog
                          title={`Delete ${client.name}?`}
                          description="This will remove the client and all associated invoices."
                          triggerLabel="Delete"
                          confirmLabel="Delete client"
                          triggerClassName="button-danger-sm"
                          formAction={deleteClient}
                          hiddenFields={{ client_id: client.id }}
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
              basePath="/clients"
              searchParams={resolvedSearchParams}
            />
          </>
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
