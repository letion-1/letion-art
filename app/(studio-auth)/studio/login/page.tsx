"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function StudioLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace("/studio");
      router.refresh();
    } catch (error) {
      console.error(error);

      setMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f0e9] px-6 text-[#111111]">
      <div className="w-full max-w-md">
        {/* BRAND */}
        <div className="border-b border-black/10 pb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-black/45">
            Letion Ketienya
          </p>

          <h1 className="mt-5 text-5xl font-medium tracking-[-0.04em] md:text-6xl">
            Studio
          </h1>

          <p className="mt-5 max-w-sm text-base leading-7 text-black/55">
            Private artist workspace for managing artworks,
            collections, originals and prints.
          </p>
        </div>

        {/* LOGIN FORM */}
        <form
          onSubmit={handleSubmit}
          className="mt-10"
        >
          {/* EMAIL */}
          <div>
            <label
              htmlFor="email"
              className="text-xs uppercase tracking-[0.2em] text-black/50"
            >
              Studio email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              className="mt-3 w-full border-b border-black/25 bg-transparent py-4 text-lg outline-none transition placeholder:text-black/25 focus:border-black"
              placeholder="you@example.com"
            />
          </div>

          {/* PASSWORD */}
          <div className="mt-8">
            <label
              htmlFor="password"
              className="text-xs uppercase tracking-[0.2em] text-black/50"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              className="mt-3 w-full border-b border-black/25 bg-transparent py-4 text-lg outline-none transition placeholder:text-black/25 focus:border-black"
              placeholder="••••••••"
            />
          </div>

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="mt-10 w-full border border-black bg-black px-6 py-4 text-xs uppercase tracking-[0.2em] text-white transition hover:bg-transparent hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading
              ? "Entering Studio..."
              : "Enter Studio"}
          </button>

          {/* ERROR */}
          {message && (
            <div className="mt-6 border-t border-black/10 pt-5">
              <p className="text-sm leading-6 text-red-700">
                {message}
              </p>
            </div>
          )}
        </form>

        {/* FOOTER */}
        <div className="mt-12 flex items-center justify-between border-t border-black/10 pt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-black/30">
            Private access
          </p>

          <a
            href="/"
            className="text-xs uppercase tracking-[0.2em] text-black/45 transition hover:text-black"
          >
            ← Back to website
          </a>
        </div>
      </div>
    </main>
  );
}