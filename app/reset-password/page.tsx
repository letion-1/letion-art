
"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Mode = "checking" | "request" | "reset" | "done";

export default function ResetPasswordPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        (
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )!
      ),
    []
  );

  const [mode, setMode] = useState<Mode>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkRecovery() {
      const hash = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const linkError = hash.get("error_description");

      if (linkError) {
        if (active) {
          setError(linkError);
          setMode("request");
        }
        window.history.replaceState(null, "", "/reset-password");
        return;
      }

      try {
        // A recovery link may already have created a session.
        const { data } = await supabase.auth.getUser();

        if (data.user) {
          if (active) setMode("reset");
          window.history.replaceState(null, "", "/reset-password");
          return;
        }

        // Handle recovery links containing access and refresh tokens.
        if (accessToken && refreshToken) {
          const { error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) throw sessionError;

          if (active) setMode("reset");
          window.history.replaceState(null, "", "/reset-password");
          return;
        }

        if (active) setMode("request");
      } catch {
        if (active) {
          setError(
            "The recovery link may have expired. Request a new link below."
          );
          setMode("request");
        }
        window.history.replaceState(null, "", "/reset-password");
      }
    }

    checkRecovery();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function sendRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/reset-password`,
          }
        );

      if (resetError) throw resetError;

      setMessage(
        "If this email has an account, a password reset link has been sent. Check your inbox."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send reset email."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) throw updateError;

      setPassword("");
      setConfirmPassword("");

      await supabase.auth.signOut();

      setMode("done");
      setMessage("Your Studio password has been changed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update password. Request a new recovery link."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f3ee] px-6 py-20 text-black">
      <section className="w-full max-w-md border border-black/15 bg-white p-8 md:p-12">
        <p className="text-[10px] uppercase tracking-[0.3em] text-black/50">
          LETION / STUDIO
        </p>

        <h1 className="mt-8 text-4xl font-medium tracking-tight">
          {mode === "request"
            ? "Recover access."
            : mode === "done"
              ? "Password updated."
              : "Reset password."}
        </h1>

        {mode === "checking" && (
          <p className="mt-6 text-sm text-black/60">
            Checking your recovery link...
          </p>
        )}

        {mode === "request" && (
          <form onSubmit={sendRecovery} className="mt-8 space-y-5">
            <p className="text-sm leading-6 text-black/60">
              Enter your Studio account email to receive a new
              password recovery link.
            </p>

            <div>
              <label className="text-[10px] uppercase tracking-widest">
                Email address
              </label>

              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full border border-black/20 px-4 py-4 text-sm outline-none focus:border-black"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black px-6 py-4 text-xs uppercase tracking-widest text-white disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send recovery email"}
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={updatePassword} className="mt-8 space-y-5">
            <p className="text-sm leading-6 text-black/60">
              Choose a new password for your Studio account.
            </p>

            <div>
              <label className="text-[10px] uppercase tracking-widest">
                New password
              </label>

              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full border border-black/20 px-4 py-4 text-sm outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest">
                Confirm new password
              </label>

              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                className="mt-2 w-full border border-black/20 px-4 py-4 text-sm outline-none focus:border-black"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black px-6 py-4 text-xs uppercase tracking-widest text-white disabled:opacity-50"
            >
              {loading ? "Updating..." : "Save new password"}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-5 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-5 text-sm text-black/70">
            {message}
          </p>
        )}

        {mode === "done" && (
          <a
            href="/studio/login"
            className="mt-7 block bg-black px-6 py-4 text-center text-xs uppercase tracking-widest text-white"
          >
            Return to Studio login
          </a>
        )}
      </section>
    </main>
  );
}
