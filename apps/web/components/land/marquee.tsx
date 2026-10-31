"use client";

import { useEffect, useRef } from "react";
import { CALLERS } from "./callers";

const LINES = CALLERS.map((c) => c.quote);

export function Marquee() {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el || document.documentElement.dataset.motion !== "on") return;
    let last = window.scrollY;
    let dir = 1;
    const onScroll = () => {
      const y = window.scrollY;
      const v = y - last;
      last = y;
      dir = v < 0 ? -1 : 1;
      const duration = Math.max(10, 36 / (1 + Math.abs(v) * 0.08));
      el.style.animationDuration = `${duration}s`;
      el.style.animationDirection = dir < 0 ? "reverse" : "normal";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track" ref={track}>
        {[0, 1].map((copy) =>
          LINES.map((line, i) => (
            <span key={`${copy}-${i}`}>
              {line}
              <em>·</em>
            </span>
          )),
        )}
      </div>
    </div>
  );
}
