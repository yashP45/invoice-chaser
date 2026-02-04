import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto max-w-3xl space-y-10 text-center">
      <div className="space-y-4">
        <span className="inline-flex items-center rounded-full border border-slate-200/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Start here
        </span>
        <h1 className="text-3xl font-semibold">Create your account in minutes.</h1>
        <p className="text-slate-600 text-sm">
          Import invoices, track aging, and follow up automatically using our 7/14/21 cadence.
        </p>
        <div className="card mx-auto max-w-xl p-4 text-sm text-slate-600">
          No billing in MVP. Just create an account and upload a CSV.
        </div>
      </div>
      <div className="mx-auto w-full max-w-md space-y-4 text-left">
        <AuthForm mode="signup" />
        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="text-ink underline" href="/login">
            Log in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
