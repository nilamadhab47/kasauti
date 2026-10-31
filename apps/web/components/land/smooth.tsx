"use client";

import { useEffect } from "react";

export function Smooth() {
  useEffect(() => {
    if (document.documentElement.dataset.motion !== "on") return;
    if ((window as unknown as { __KASAUTI_PROOF?: boolean }).__KASAUTI_PROOF) return;
    let stop: (() => void) | undefined;
    (async () => {
      const Lenis = (await import("lenis")).default;
      const lenis = new Lenis({ autoRaf: false, duration: 1.05 });
      let gsap: typeof import("gsap").default | undefined;
      try {
        gsap = (await import("gsap")).default;
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        gsap.registerPlugin(ScrollTrigger);
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add((time) => {
          lenis.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
      } catch {
        const loop = (t: number) => {
          lenis.raf(t);
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }
      stop = () => {
        lenis.destroy();
        gsap?.ticker.lagSmoothing(500, 33);
      };
    })();
    return () => stop?.();
  }, []);
  return null;
}

export function Reveals() {
  useEffect(() => {
    if (document.documentElement.dataset.motion !== "on") {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => el.classList.add("is-in"));
      return;
    }
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
