import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto max-w-3xl space-y-10 text-center">
      <div className="space-y-4">
        <span className="inline-flex items-center rounded-full border border-slate-200/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Welcome back
        </span>
        <h1 className="text-3xl font-semibold">Stay on top of overdue invoices.</h1>
        <p className="text-slate-600 text-sm">
          Log in to track aging invoices, run reminders, and keep cash flow healthy.
        </p>
        <div className="card mx-auto max-w-xl p-4 text-sm text-slate-600">
          “Invoice Chaser helped us recover 18% faster in the first month.”
        </div>
      </div>
      <div className="mx-auto w-full max-w-md space-y-4 text-left">
        <AuthForm mode="login" />
        <p className="text-center text-sm text-slate-600">
          New here?{" "}
          <Link className="text-ink underline" href="/signup">
            Create an account
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
