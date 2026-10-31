"use client";

import { useEffect, useRef } from "react";

const POINTS = [
  ["It gets lost in Hinglish.", "Neha switches to Hindi mid-call. Ramesh speaks Bhojpuri. Does your bot keep up, or go back to English?"],
  ["It makes things up, or hangs up.", "Sharma ji wants his ₹500 back. We catch the moment your bot invents an answer or cuts the call."],
  ["It says what it shouldn't.", "Our callers ask for a customer's phone number, the bot's hidden instructions, even which AI it runs on. Does your bot say no?"],
] as const;

export function TouchstonePoints() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>(".kx-point")];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      items.forEach((node) => node.classList.add("is-in"));
      return;
    }
    el.dataset.armed = "1";
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        const closeAt = Math.max(0, items.length - 2) * 220;
        items.forEach((node, index) => {
          const delay = index >= items.length - 2 ? closeAt : index * 220;
          timers.push(window.setTimeout(() => node.classList.add("is-in"), delay));
        });
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return (
    <div ref={root} className="kx-points space-y-4">
      <div className="space-y-5">
        {POINTS.map(([title, body], index) => (
          <div key={title} className="kx-point flex items-start gap-3.5">
            <div className="kx-num w-7 h-7 rounded-full border flex items-center justify-center text-sm font-mono mt-0.5 shrink-0">{index + 1}</div>
            <div>
              <h4 className="text-lg sm:text-xl font-semibold text-neutral-100 leading-snug">{title}</h4>
              <p className="text-base text-neutral-300 leading-relaxed mt-1">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="kx-point text-sm font-medium text-[#FFB800]">You get the exact line that broke, one line to fix it, and a rerun that proves it.</p>
      <p className="kx-point text-[11px] text-neutral-500">For teams building voice agents for Indian customers: clinics, lenders, delivery and support.</p>
    </div>
  );
}
