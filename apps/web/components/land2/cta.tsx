"use client";

import { useEffect, useRef, useState } from "react";

const HEADLINE = "Your customers shouldn't be your testers.".split(" ");

const GETS = [
  { icon: "rec" as const, label: "The call recording" },
  { icon: "line" as const, label: "The exact line that broke" },
  { icon: "fix" as const, label: "The change that fixes it" },
  { icon: "rerun" as const, label: "A rerun that proves it" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BARS = 22;

export function ConversionDock() {
  const root = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [inView, setInView] = useState(false);
  const [armed, setArmed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState<"form" | "calling" | "done">("form");
  const [error, setError] = useState("");
  const emailOk = EMAIL.test(email.trim());
  const ready = emailOk && consent && phase === "form";

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const prefers = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(prefers);
    if (prefers || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setArmed(true);
        raf = window.requestAnimationFrame(() => setInView(true));
        io.disconnect();
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, []);

  function focusField() {
    setTyping(true);
  }

  function blurField(event: React.FocusEvent) {
    const next = event.relatedTarget;
    if (next instanceof Node && formRef.current?.contains(next)) return;
    setTyping(false);
  }

  function nudge(event: React.MouseEvent<HTMLSpanElement>) {
    const el = event.currentTarget;
    if (reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left - box.width / 2) * 0.28;
    const y = (event.clientY - box.top - box.height / 2) * 0.28;
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    const address = email.trim();
    setTyping(false);
    setPhase("calling");
    setError("");
    const started = Date.now();
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, phone: phone.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Something went wrong. Try again.");
      }
      const hold = reduced ? 0 : Math.max(0, 1200 - (Date.now() - started));
      window.setTimeout(() => setPhase("done"), hold);
    } catch (err) {
      setPhase("form");
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    <section
      ref={root}
      id="free-test"
      className={`kx-cta py-24 bg-[#0E0D0C] text-white relative overflow-hidden ${armed ? "is-armed" : ""} ${inView ? "is-in" : ""} ${typing ? "is-typing" : ""}`}
    >
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#FFB800]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-mono mb-6">
          <span className="w-2 h-2 rounded-full bg-[#FFB800]" />
          <span className="uppercase tracking-wider">Voice agent stress test</span>
        </div>
        <h2 className="font-display font-bold text-4xl sm:text-5xl text-neutral-100 tracking-tight leading-tight">
          {HEADLINE.map((word, index) => (
            <span key={`${word}-${index}`}>
              <span className="kx-cta-word">
                <span style={{ transitionDelay: `${index * 75}ms` }}>{word}</span>
              </span>
              {index < HEADLINE.length - 1 ? " " : null}
            </span>
          ))}
        </h2>
        <p className="text-neutral-400 text-base sm:text-lg mt-4 max-w-2xl mx-auto">
          Kasauti calls your voice agent as tough Indian callers and shows you exactly what broke, and how to fix it. Fix it before it costs you a customer, a refund, or a leaked phone number.
        </p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {GETS.map((item, index) => (
            <li
              key={item.label}
              className="kx-get inline-flex items-center gap-2 text-sm text-neutral-200"
              style={{ transitionDelay: `${520 + index * 120}ms` }}
            >
              <GetIcon name={item.icon} />
              {item.label}
            </li>
          ))}
        </ul>

        <div className="relative mt-8 max-w-2xl mx-auto">
          {phase !== "done" ? <BackdropWave /> : null}
          <div className="relative z-10 bg-neutral-900 p-3 sm:p-4 rounded-3xl border border-neutral-700 shadow-2xl">
            {phase === "done" ? (
              <div role="status" aria-live="polite" className="kx-cta-success relative z-10 px-4 py-8">
                {reduced ? null : <SuccessWave />}
                <p className="kx-cta-success-copy text-base sm:text-lg text-neutral-100">
                  You&apos;re in. We&apos;ll call your bot and send your first report to <span className="text-[#FFB800]">{email.trim()}</span>.
                </p>
              </div>
            ) : (
              <form ref={formRef} className="relative z-10 flex flex-col gap-3" onSubmit={submit} noValidate>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full sm:flex-1">
                    <label className="sr-only" htmlFor="work-email">
                      Work email
                    </label>
                    <input
                      className="w-full px-4 py-3 rounded-2xl bg-black border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#FFB800] text-sm font-sans"
                      id="work-email"
                      name="email"
                      placeholder="Work email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      onFocus={focusField}
                      onBlur={blurField}
                      required
                    />
                  </div>
                  <div className="w-full sm:flex-1">
                    <label className="sr-only" htmlFor="bot-phone">
                      Your bot&apos;s +91 number
                    </label>
                    <input
                      className="w-full px-4 py-3 rounded-2xl bg-black border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#FFB800] text-sm font-sans"
                      id="bot-phone"
                      name="phone"
                      placeholder="Your bot's +91 number"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      onFocus={focusField}
                      onBlur={blurField}
                    />
                  </div>
                  <span className="kx-cta-magnet w-full sm:w-auto" onMouseMove={nudge} onMouseLeave={(event) => (event.currentTarget.style.transform = "")}>
                    <button
                      className="kx-cta-btn w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#FFB800] to-[#D97706] hover:brightness-110 disabled:hover:brightness-100 text-neutral-950 font-display font-bold text-sm tracking-wide shadow-lg whitespace-nowrap inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={!ready}
                    >
                      {phase === "calling" ? (
                        <>
                          <span className="kx-cta-call" aria-hidden="true">
                            {Array.from({ length: 5 }, (_, index) => (
                              <i key={index} style={{ animationDelay: `${index * 0.08}s` }} />
                            ))}
                          </span>
                          Calling…
                        </>
                      ) : (
                        "Stress-test my bot →"
                      )}
                    </button>
                  </span>
                </div>
                <label className="flex items-center justify-center gap-2 text-sm text-neutral-300 text-left">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-[#FFB800]"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  I own this bot or have permission to test it.
                </label>
                {error ? (
                  <p role="alert" className="text-xs text-red-300">
                    {error}
                  </p>
                ) : null}
              </form>
            )}
          </div>
        </div>
        <p className="mt-6 text-xs text-neutral-400 font-mono">Free first test · Bolna agents today, more platforms coming · No credit card</p>
      </div>
    </section>
  );
}

function BackdropWave() {
  return (
    <div className="kx-cta-wave kx-cta-back" aria-hidden="true">
      {Array.from({ length: BARS }, (_, index) => (
        <i key={index} style={{ animationDelay: `${index * 0.12}s` }} />
      ))}
    </div>
  );
}

function SuccessWave() {
  return (
    <div className="kx-cta-wave is-solid mx-auto mb-4" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <i key={index} style={{ animationDelay: `${index * 0.08}s` }} />
      ))}
    </div>
  );
}

function GetIcon({ name }: { name: (typeof GETS)[number]["icon"] }) {
  const stroke = { fill: "none", stroke: "#FFB800", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      {name === "rec" ? (
        <>
          <circle {...stroke} cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" fill="#FFB800" />
        </>
      ) : null}
      {name === "line" ? <path {...stroke} d="M5 7h14M5 12h10M5 17h12" /> : null}
      {name === "fix" ? <path {...stroke} d="M4 20h4l10-10-4-4L4 16zM13 7l4 4" /> : null}
      {name === "rerun" ? <path {...stroke} d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" /> : null}
    </svg>
  );
}
