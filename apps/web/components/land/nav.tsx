"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Magnetic } from "./magnetic";
import { Mark } from "./mark";

const LINKS = [
  { href: "#callers", id: "callers", label: "Callers" },
  { href: "#report", id: "report", label: "Report" },
  { href: "#story", id: "story", label: "How it works" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const [bar, setBar] = useState({ x: 0, w: 0 });

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      const here = LINKS.map((l) => {
        const el = document.getElementById(l.id);
        if (!el) return { id: l.id, top: Infinity };
        return { id: l.id, top: Math.abs(el.getBoundingClientRect().top - 120) };
      }).sort((a, b) => a.top - b.top)[0];
      setActive(here?.id ?? "");
      const nav = document.querySelector(".nav-links");
      const link = nav?.querySelector<HTMLAnchorElement>(`a[href="#${here?.id}"]`);
      if (nav && link) {
        const a = nav.getBoundingClientRect();
        const b = link.getBoundingClientRect();
        setBar({ x: b.left - a.left, w: b.width });
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={scrolled ? "nav is-scrolled" : "nav"}>
      <Link href="/" aria-label="Kasauti, home" className="nav-brand">
        <Mark height={40} />
      </Link>
      <nav className="nav-links" aria-label="Page">
        {LINKS.map((l) => (
          <a key={l.id} href={l.href} data-active={active === l.id ? "true" : "false"}>
            {l.label}
          </a>
        ))}
        <span className="nav-bar" style={{ transform: `translateX(${bar.x}px) scaleX(${bar.w || 1})` }} />
        <Magnetic>
          <a className="btn btn-primary shine" href="#test">
            Test my bot
          </a>
        </Magnetic>
      </nav>
      <a className="btn btn-primary nav-mobile" href="#test">
        Test my bot
      </a>
    </header>
  );
}
