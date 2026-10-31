import type { ShopId } from "@/lib/prototype";

export function ShopMark({ id }: { id: ShopId }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "clinic") {
    return (
      <svg viewBox="0 0 120 72" className="h-16 w-28 text-ink" aria-hidden>
        <path {...common} d="M18 62 V28 L60 12 L102 28 V62" />
        <path {...common} d="M48 62 V44 H72 V62" />
        <path {...common} stroke="#b86a24" d="M60 30 V46 M52 38 H68" />
      </svg>
    );
  }
  if (id === "mobile") {
    return (
      <svg viewBox="0 0 120 72" className="h-16 w-28 text-ink" aria-hidden>
        <rect {...common} x="42" y="10" width="36" height="52" rx="4" />
        <path {...common} stroke="#b86a24" d="M54 28 L66 40 L54 40 L66 52" />
      </svg>
    );
  }
  if (id === "salon") {
    return (
      <svg viewBox="0 0 120 72" className="h-16 w-28 text-ink" aria-hidden>
        <ellipse {...common} cx="42" cy="32" rx="16" ry="20" />
        <path {...common} stroke="#b86a24" d="M42 52 V66 M74 22 L98 54 M98 22 L74 54" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 72" className="h-16 w-28 text-ink" aria-hidden>
      <path {...common} d="M16 28 H104 L96 16 H24 Z" />
      <path {...common} d="M24 28 V60 H96 V28" />
      <path {...common} stroke="#b86a24" d="M40 60 V42 H58 V60" />
    </svg>
  );
}

export function Wave({ on }: { on: boolean }) {
  return (
    <span className={`wave ${on ? "on" : ""}`} aria-hidden>
      {Array.from({ length: 12 }, (_, index) => (
        <i key={index} style={{ ["--i" as string]: index }} />
      ))}
    </span>
  );
}
