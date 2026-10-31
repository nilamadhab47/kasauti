"use client";

import { useRef } from "react";

export function Magnetic({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  function move(event: React.MouseEvent<HTMLSpanElement>) {
    const el = ref.current;
    if (!el || document.documentElement.dataset.motion !== "on") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left - box.width / 2) * 0.28;
    const y = (event.clientY - box.top - box.height / 2) * 0.28;
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  function leave() {
    if (ref.current) ref.current.style.transform = "translate(0, 0)";
  }

  return (
    <span ref={ref} className={`magnetic ${className ?? ""}`} onMouseMove={move} onMouseLeave={leave}>
      {children}
    </span>
  );
}
