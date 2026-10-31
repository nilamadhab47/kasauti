"use client";

import { useEffect, useRef } from "react";

const LINE = "“I have cancelled appointment ID 241 for you.”";

export function BrokeQuote() {
  const ref = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wipe = el.querySelector<HTMLElement>(".wipe");
    if (!wipe) return;
    if (document.documentElement.dataset.motion !== "on") {
      wipe.style.transform = "scaleX(1)";
      return;
    }
    let revert: (() => void) | undefined;
    (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        gsap.fromTo(
          wipe,
          { transform: "scaleX(0)" },
          {
            transform: "scaleX(1)",
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 85%", end: "top 35%", scrub: true },
          },
        );
      }, el);
      revert = () => ctx.revert();
    })();
    return () => revert?.();
  }, []);

  return (
    <blockquote ref={ref} lang="en" className="broke-quote">
      <span className="base">{LINE}</span>
      <span className="wipe" aria-hidden="true" />
    </blockquote>
  );
}
