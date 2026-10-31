"use client";

import { useRef, useState } from "react";
import { Magnetic } from "./magnetic";
import { Waveform } from "./wave";

type State = "idle" | "sending" | "done" | "error";

export function Waitlist() {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a work email.");
      emailRef.current?.focus();
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Something went wrong.");
      }
      window.setTimeout(() => setState("done"), 700);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (state === "done") {
    return (
      <div role="status" aria-live="polite" className="waitlist-done">
        <p className="stamp stamp-pass">You&apos;re in</p>
        <p className="lead">We&apos;ll call your bot soon.</p>
        <p className="note">We&apos;ll email you from a real person when your slot opens. No drip sequence.</p>
      </div>
    );
  }

  if (state === "sending") {
    return (
      <div className="waitlist-sending" role="status" aria-live="polite">
        <Waveform live />
        <p>Adding you…</p>
      </div>
    );
  }

  return (
    <form className="waitlist" onSubmit={submit} noValidate>
      <div className="waitlist-fields">
        <label className="field">
          <span className="field-label">Work email</span>
          <input
            ref={emailRef}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={state === "error" || Boolean(error)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">
            Your bot&apos;s number <span className="field-opt">optional</span>
          </span>
          <input name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="+91 ..." />
        </label>
      </div>
      <Magnetic>
        <button type="submit" className="btn btn-primary shine">
          Test my bot
        </button>
      </Magnetic>
      {error ? (
        <p role="alert" className="waitlist-error">
          {error}
        </p>
      ) : (
        <p className="waitlist-note">Early access. We call the number you paste — no card, no scripts to write.</p>
      )}
    </form>
  );
}
