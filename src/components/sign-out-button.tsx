"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <button className="button-secondary" onClick={handleSignOut} type="button">
      Sign out
    </button>
  );
}
