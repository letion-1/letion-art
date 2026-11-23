"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useCallback, useEffect, useMemo, useState } from "react";

const baseStyle = "w-full rounded-sm border border-black/20 px-4 py-3 text-sm";
const buttonStyle = "rounded-sm bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-40";

export default function StudioMfaSetup() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  ), []);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking your authenticator setup...");

  const refresh = useCallback(async () => {
    const [factors, assurance] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factors.error) { setMessage(factors.error.message); return; }
    if (assurance.error) { setMessage(assurance.error.message); return; }
    if (assurance.data?.currentLevel === "aal2") {
      setReady(true);
      setMessage("Your Studio session is protected with two-factor authentication.");
      return;
    }
    const existing = factors.data?.totp?.find(f => f.status === "verified");
    if (existing) {
      setFactorId(existing.id);
      setMessage("Enter the six-digit code from your authenticator app to unlock Studio.");
    } else {
      setFactorId("");
      setMessage("Set up an authenticator app to protect your Studio account.");
    }
  }, [supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function enroll() {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp", friendlyName: "LETION ART Studio",
      });
      if (error) throw error;
      if (!data?.id || !data.totp?.qr_code) throw new Error("Supabase did not return an authenticator QR code.");
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret ?? "");
      setMessage("Scan this QR code with your authenticator app, then enter its six-digit code.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to enroll authenticator.");
    } finally { setBusy(false); }
  }

  async function verify() {
    if (!factorId || !/^\d{6}$/.test(code.trim())) {
      setMessage("Enter a valid six-digit authenticator code."); return;
    }
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId, code: code.trim(),
      });
      if (error) throw error;
      setQr(""); setSecret(""); setCode("");
      const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (level.error || level.data?.currentLevel !== "aal2") {
        throw new Error("The authenticator code was accepted but AAL2 is not active. Refresh and try again.");
      }
      setReady(true);
      setMessage("Verified. Your session now has AAL2 protection.");
      window.location.assign("/studio");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authenticator verification failed.");
    } finally { setBusy(false); }
  }

  async function signOutOfStudio() {
    setBusy(true);
    setMessage("Signing out of Studio...");
    try {
      // End only the current browser session, not all your devices.
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      window.location.replace("/studio/login");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign out. Please retry.");
      setBusy(false);
    }
  }

  return (
    <section className="mt-7 space-y-5" aria-label="Studio two-factor authentication">
      {ready ? (
        <p className="rounded-sm border border-green-800/20 bg-green-50 p-4 text-sm text-green-900">
          Two-factor authentication verified for this session.
        </p>
      ) : (
        <>
          {!factorId && (
            <button type="button" disabled={busy} onClick={enroll} className={buttonStyle}>
              Set up authenticator
            </button>
          )}
          {qr && (
            <div className="rounded-sm border border-black/10 p-4">
              <p className="mb-3 text-sm font-medium">Scan using your authenticator app</p>
              {/* Supabase returns a data: URL; never send TOTP secrets to external QR services. */}
              <img src={qr} alt="One-time authenticator enrollment QR code" width={220} height={220} />
              {secret && (
                <p className="mt-3 break-all text-xs text-black/60">
                  Can't scan? Enter this secret manually in your authenticator app: <code>{secret}</code>
                </p>
              )}
              <p className="mt-3 text-xs text-red-800">Keep this QR code and secret private. Do not share a screenshot.</p>
            </div>
          )}
          {factorId && (
            <div className="space-y-3">
              <label htmlFor="mfa-code" className="block text-sm font-semibold">Authenticator code</label>
              <input id="mfa-code" className={baseStyle} value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
                maxLength={6} placeholder="000000" />
              <button type="button" disabled={busy || code.length !== 6} onClick={verify} className={buttonStyle}>
                Verify code
              </button>
            </div>
          )}
        </>
      )}
      <p className="text-sm leading-6 text-black/65" role="status">{message}</p>
      <button
        type="button"
        onClick={signOutOfStudio}
        disabled={busy}
        className="mt-3 inline-flex items-center justify-center rounded-sm border border-black/20 px-5 py-3 text-sm font-semibold text-black hover:bg-black/5 disabled:opacity-40"
      >
        Sign out of Studio
      </button>
      <p className="text-xs leading-5 text-black/50">
        If you lose access to your authenticator app, account recovery requires a verified administrator.
        Never disable database security to regain access.
      </p>
    </section>
  );
}
