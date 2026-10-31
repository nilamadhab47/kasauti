"use client";

import { useEffect, useState } from "react";
import { SITE_LINKS } from "@/components/land2/site-links";

export function SiteNav() {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > last && y > 80);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md bg-[#FFFDFB]/90 border-b border-[#0F0E0D]/10 transition-transform duration-300 ${
        hidden && !open ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        <a className="flex items-center gap-3 group shrink-0" href="#top">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center p-0.5 bg-[#0E0D0C] shadow-sm transition-transform duration-300 group-hover:scale-105">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Kasauti emblem" className="w-full h-full object-contain kx-logo-live" src="/brand/touchstone.png" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-2xl tracking-tight leading-none">Kasauti</span>
            <span className="hidden sm:block font-mono text-[10px] tracking-wider text-neutral-500 uppercase">कसौटी · Voice agent tests</span>
          </div>
        </a>
        <nav className="hidden lg:flex items-center gap-6 font-medium text-sm text-[#0F0E0D]/80">
          {SITE_LINKS.map((link) => (
            <a key={link.href} className="hover:text-black transition-colors" href={link.href}>
              {link.label}
            </a>
          ))}
          <a className="hover:text-black transition-colors" href="/score/sehat">
            Sample report
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <a
            className="inline-flex items-center px-4 py-2.5 rounded-full bg-[#0E0D0C] text-white text-xs font-semibold tracking-wide uppercase shadow hover:bg-neutral-800 transition duration-200"
            href="/workspace"
          >
            <span className="hidden sm:inline">Stress-test my bot</span>
            <span className="sm:hidden">Test my bot</span>
          </a>
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full border border-neutral-300 text-sm"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="site-menu" className="lg:hidden border-t border-neutral-200 bg-[#FFFDFB] px-4 py-3 flex flex-col">
          {SITE_LINKS.map((link) => (
            <a key={link.href} className="py-3 text-sm font-medium border-b border-neutral-100" href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a className="py-3 text-sm font-medium" href="/score/sehat" onClick={() => setOpen(false)}>
            Sample report
          </a>
        </nav>
      ) : null}
    </header>
  );
}
