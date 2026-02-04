"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "signup") {
      if (!fullName.trim()) {
        const errorMessage = "Please enter your full name.";
        setMessage(errorMessage);
        addToast({
          title: "Missing name",
          description: errorMessage,
          variant: "error"
        });
        setLoading(false);
        return;
      }

      if (password.length < 8) {
        const errorMessage = "Password must be at least 8 characters.";
        setMessage(errorMessage);
        addToast({
          title: "Weak password",
          description: errorMessage,
          variant: "error"
        });
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        const errorMessage = "Passwords do not match.";
        setMessage(errorMessage);
        addToast({
          title: "Password mismatch",
          description: errorMessage,
          variant: "error"
        });
        setLoading(false);
        return;
      }
    }

    const supabase = createBrowserSupabaseClient();
    const action =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName.trim()
              }
            }
          });

    const { error } = await action;
    if (error) {
      setMessage(error.message);
      addToast({
        title: "Authentication error",
        description: error.message,
        variant: "error"
      });
      setLoading(false);
      return;
    }

    addToast({
      title: mode === "login" ? "Welcome back" : "Account created",
      description: "Redirecting you to your dashboard.",
      variant: "success"
    });
    window.location.href = "/";
  };

  return (
    <form className="card p-6 space-y-4" onSubmit={handleSubmit}>
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="full-name">
            Full name
          </label>
          <input
            id="full-name"
            className="input mt-1"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            required
          />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="input mt-1"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <div className="relative mt-1">
          <input
            id="password"
            className="input pr-20"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-pressed={showPassword}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="confirm-password">
            Confirm password
          </label>
          <div className="relative mt-1">
            <input
              id="confirm-password"
              className="input pr-20"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-pressed={showConfirm}
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      )}
      {message && <p className="text-sm text-ember">{message}</p>}
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Working..." : mode === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  );
}
