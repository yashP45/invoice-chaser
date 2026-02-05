import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { FloatingNav } from "@/components/floating-nav";

export async function TopNav() {
  const user = await getUser();

  return (
    <header className="fixed left-1/2 top-6 z-50 w-[min(95vw,1120px)] -translate-x-1/2">
      <FloatingNav>
        <div className="rounded-full border border-slate-200/70 bg-white/85 px-4 py-3 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.55)] backdrop-blur">
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="hidden items-center gap-3 md:flex">
              <Link href="/" className="text-lg font-semibold text-ink">
                <span className="flex items-center gap-3">
                  <img
                    src="/logo-mark.svg"
                    alt=""
                    aria-hidden="true"
                    className="h-8 w-8"
                  />
                  <span>Invoice Chaser</span>
                </span>
              </Link>
            </div>
            <nav className="hidden items-center justify-center gap-6 text-sm font-semibold text-slate-600 md:flex">
              {user ? (
                <>
                  <Link href="/">Dashboard</Link>
                  <Link href="/invoices">Invoices</Link>
                  <Link href="/imports">Imports</Link>
                  <Link href="/clients">Clients</Link>
                  <Link href="/reminders">Reminders</Link>
                  <Link href="/settings">Settings</Link>
                </>
              ) : (
                <>
                  <Link href="/#features">Features</Link>
                  <Link href="/#workflow">Workflow</Link>
                  <Link href="/#pricing">Pricing</Link>
                </>
              )}
            </nav>
            <div className="flex items-center justify-between gap-3 md:justify-end">
              <Link href="/" className="text-lg font-semibold text-ink md:hidden">
                <span className="flex items-center gap-2">
                <img
                  src="/logo-mark.svg"
                  alt=""
                  aria-hidden="true"
                  className="h-7 w-7"
                />
                <span>Invoice Chaser</span>
              </span>
            </Link>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <span className="hidden rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500 lg:inline-flex">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link className="button-secondary" href="/login">
                    Log in
                  </Link>
                  <Link className="button" href="/signup">
                    Start free
                  </Link>
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      </FloatingNav>
    </header>
  );
}
