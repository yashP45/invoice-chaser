import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { updateClientEmail } from "@/lib/actions";
import { LoadingButton } from "@/components/loading-button";

export const dynamic = "force-dynamic";

async function updateClientEmailAndRedirect(formData: FormData) {
  "use server";
  await updateClientEmail(formData);
  redirect("/clients");
}

export default async function EditClientPage({
  params
}: {
  params: { id: string };
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) {
    redirect("/clients");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edit client</h1>
          <p className="text-sm text-slate-600">Update contact details.</p>
        </div>
        <Link className="button-secondary" href="/clients">
          Back to clients
        </Link>
      </div>

      <form action={updateClientEmailAndRedirect} className="card p-6 space-y-4">
        <input type="hidden" name="client_id" value={client.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="client-name">
              Client name
            </label>
            <input
              id="client-name"
              className="input mt-1"
              value={client.name}
              disabled
              readOnly
            />
          </div>
          <div>
            <label className="label" htmlFor="client-email">
              Client email
            </label>
            <input
              id="client-email"
              className="input mt-1"
              type="email"
              name="email"
              defaultValue={client.email}
              required
            />
          </div>
        </div>
        <div className="flex gap-3">
          <LoadingButton className="button" pendingText="Saving...">
            Save changes
          </LoadingButton>
          <Link className="button-secondary" href="/clients">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
