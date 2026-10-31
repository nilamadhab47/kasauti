"use client";

import { useEffect } from "react";

/**
 * Effect-only motion controller for the landing page. Renders nothing.
 * - Reveals [data-reveal] blocks as they scroll in (entrance, ease-out).
 * - Hides the nav on scroll down, shows it on scroll up (spatial, prevents the
 *   sticky bar from covering content).
 * All of this is gated: if the inline head script set data-motion="off"
 * (reduced motion) we reveal everything immediately and never move the nav.
 */
export function LandMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const motionOn = root.dataset.motion === "on";
    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>(".land .board:not(.hero) > *"),
    ).filter((el) => !el.classList.contains("marquee"));

    if (!motionOn || typeof IntersectionObserver === "undefined") {
      reveals.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    reveals.forEach((el) => io.observe(el));

    // Nav hide-on-scroll
    const nav = document.querySelector<HTMLElement>(".land-nav");
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (nav) {
          const goingDown = y > lastY && y > 120;
          nav.dataset.hidden = goingDown ? "true" : "false";
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
