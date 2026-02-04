import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Add client</h1>
          <p className="text-sm text-slate-600">Create a client profile.</p>
        </div>
        <Link className="button-secondary" href="/clients">
          Back to clients
        </Link>
      </div>

      <form action={createClient} className="card p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="new-client-name">
              Client name
            </label>
            <input id="new-client-name" name="name" className="input mt-1" required />
          </div>
          <div>
            <label className="label" htmlFor="new-client-email">
              Client email
            </label>
            <input
              id="new-client-email"
              type="email"
              name="email"
              className="input mt-1"
              required
            />
          </div>
        </div>
        <button className="button" type="submit">
          Add client
        </button>
      </form>
    </div>
  );
}
