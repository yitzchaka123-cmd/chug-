"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { choirConfig } from "../../site-config";

function RecoveryForm() {
  const [email, setEmail] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const token = useSearchParams().get("token") || "";

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (token && newPasscode !== confirmPasscode) throw new Error("The two passcodes do not match.");
      const response = await fetch("/api/admin/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { action: "confirm", token, newPasscode } : { action: "request", email }) });
      const result = await response.json() as { error?: string; reset?: boolean; deliveryConfigured?: boolean };
      if (!response.ok) throw new Error(result.error || "Recovery could not be completed.");
      if (result.reset) setMessage("Your passcode has been reset. Return to the website and use the hidden corner to sign in.");
      else if (result.deliveryConfigured) setMessage("If that email matches the configured recovery address, a private 30-minute reset link has been sent.");
      else setMessage("The recovery request was saved, but email delivery is not configured yet. Use the current passcode or connect the email service from Settings.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Recovery could not be completed."); } finally { setBusy(false); }
  }

  return <main className="recovery-shell"><section className="recovery-card"><Link href="/"><img src={choirConfig.brand.logo} alt="The Choir Chug" /></Link><p className="eyebrow">Administrator recovery</p><h1>{token ? "Choose a new passcode" : "Reset administrator access"}</h1><p>{token ? "This private recovery link works once and expires after 30 minutes." : "Enter the recovery email saved in administrator Settings."}</p>{message ? <div className="recovery-message">{message}</div> : <form onSubmit={submit}>{token ? <><label><span>New passcode</span><input type="password" minLength={4} maxLength={128} value={newPasscode} onChange={(event) => setNewPasscode(event.target.value)} required /></label><label><span>Confirm passcode</span><input type="password" minLength={4} maxLength={128} value={confirmPasscode} onChange={(event) => setConfirmPasscode(event.target.value)} required /></label></> : <label><span>Recovery email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}{error && <p className="field-error">{error}</p>}<button className="button button-full" disabled={busy}>{busy ? "Please wait…" : token ? "Reset passcode" : "Send private reset link"}</button></form>}<Link className="text-link" href="/">Return to website</Link></section></main>;
}

export default function AdminRecovery() {
  return <Suspense fallback={<main className="recovery-shell"><section className="recovery-card"><p>Loading recovery…</p></section></main>}><RecoveryForm /></Suspense>;
}
