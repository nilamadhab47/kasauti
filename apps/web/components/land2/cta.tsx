"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const HEADLINE = "Your customers shouldn't be your testers.".split(" ");

const GETS = [
  { icon: "rec" as const, label: "The call recording" },
  { icon: "line" as const, label: "The exact line that broke" },
  { icon: "fix" as const, label: "The change that fixes it" },
  { icon: "rerun" as const, label: "A rerun that proves it" },
];

export function ConversionDock() {
  const root = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
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

  return (
    <section
      ref={root}
      id="free-test"
      className={`kx-cta py-24 bg-[#0E0D0C] text-white relative overflow-hidden ${armed ? "is-armed" : ""} ${inView ? "is-in" : ""}`}
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
        <Link
          href="/workspace"
          className="mt-10 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFB800] to-[#D97706] px-8 py-4 font-display text-sm font-bold tracking-wide text-neutral-950 shadow-lg hover:brightness-110"
        >
          Stress-test my bot →
        </Link>
        <p className="mt-6 text-xs text-neutral-400 font-mono">Bolna agents today, more platforms coming</p>
      </div>
    </section>
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
