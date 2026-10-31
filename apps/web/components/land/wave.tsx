"use client";

import { useEffect, useState } from "react";
import { BAR_REST } from "./logo";

export function Waveform({
  live = false,
  tone = "gold",
  collapsed = false,
}: {
  live?: boolean;
  tone?: "gold" | "fail" | "pass";
  collapsed?: boolean;
}) {
  const rest = collapsed ? BAR_REST.map((h) => h * 0.18) : BAR_REST;
  const [heights, setHeights] = useState(rest);

  useEffect(() => {
    if (!live || document.documentElement.dataset.motion !== "on") {
      setHeights(collapsed ? BAR_REST.map((h) => h * 0.18) : BAR_REST);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      setHeights(
        BAR_REST.map((base, i) => {
          if (collapsed) return 0.08 + Math.abs(Math.sin(t * 16 + i)) * 0.12;
          return Math.min(1, 0.28 + base * (0.45 + Math.abs(Math.sin(t * 3.1 + i * 1.2)) * 0.55));
        }),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live, collapsed]);

  return (
    <span className={`bars tone-${tone}${collapsed ? " collapsed" : ""}`} aria-hidden="true">
      {heights.map((h, i) => (
        <i key={i} style={{ transform: `scaleY(${h})` }} />
      ))}
    </span>
  );
}
