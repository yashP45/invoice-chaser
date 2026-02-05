import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { FloatingNav } from "@/components/floating-nav";
import { MobileMenu } from "@/components/mobile-menu";

export async function TopNav() {
  const user = await getUser();

  return (
    <header className="fixed left-1/2 top-4 sm:top-6 z-50 w-[min(95vw,1120px)] -translate-x-1/2">
      <FloatingNav>
        <div className="rounded-full border border-slate-200/70 bg-white/85 px-3 sm:px-4 py-2 sm:py-3 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.55)] backdrop-blur">
          <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <div className="hidden items-center gap-3 lg:flex">
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
            <nav className="hidden items-center justify-center gap-6 text-sm font-semibold text-slate-600 lg:flex">
              {user ? (
                <>
                  <Link href="/">Dashboard</Link>
                  <Link href="/invoices">Invoices</Link>
                  <Link href="/imports">Imports</Link>
                  <Link href="/clients">Clients</Link>
                  <Link href="/reminders">Reminders</Link>
                  <Link href="/analytics">Analytics</Link>
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
            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <Link href="/" className="text-lg font-semibold text-ink lg:hidden">
                <span className="flex items-center gap-2">
                  <img
                    src="/logo-mark.svg"
                    alt=""
                    aria-hidden="true"
                    className="h-7 w-7"
                  />
                  <span className="hidden sm:inline">Invoice Chaser</span>
                </span>
              </Link>
              <div className="flex items-center gap-2 lg:gap-3">
                <MobileMenu user={user} />
                {user ? (
                <>
                  <a
                    className="button-secondary-sm !hidden lg:!inline-flex"
                    href="/downloads/invoice-chaser-samples.zip"
                    download
                  >
                    Download samples
                  </a>
                  <span className="hidden rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500 lg:inline-flex">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                  <div className="hidden lg:block">
                    <SignOutButton />
                  </div>
                </>
                ) : (
                  <>
                    <Link className="button-secondary text-xs sm:text-sm px-3 sm:px-4" href="/login">
                      Log in
                    </Link>
                    <Link className="button text-xs sm:text-sm px-3 sm:px-4" href="/signup">
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
