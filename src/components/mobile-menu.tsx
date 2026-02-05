"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface MobileMenuProps {
  user: {
    user_metadata?: { full_name?: string };
    email?: string;
  } | null;
}

export function MobileMenu({ user }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <svg
          className="w-6 h-6 text-slate-700"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isOpen ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[min(95vw,400px)] z-50 lg:hidden">
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xl p-4 space-y-2">
              {user ? (
                <>
                  <Link
                    href="/"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/invoices"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Invoices
                  </Link>
                  <Link
                    href="/imports"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Imports
                  </Link>
                  <Link
                    href="/clients"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Clients
                  </Link>
                  <Link
                    href="/reminders"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Reminders
                  </Link>
                  <Link
                    href="/analytics"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Analytics
                  </Link>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Settings
                  </Link>
                  <div className="border-t border-slate-200 my-2"></div>
                  <a
                    href="/downloads/invoice-chaser-samples.zip"
                    download
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Download samples
                  </a>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/#features"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Features
                  </Link>
                  <Link
                    href="/#workflow"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Workflow
                  </Link>
                  <Link
                    href="/#pricing"
                    className="block px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Pricing
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
