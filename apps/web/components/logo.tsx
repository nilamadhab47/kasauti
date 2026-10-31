const display = "[font-family:var(--font-display)]";

export function Logo({ size = "md" }: { size?: "md" | "sm" }) {
  const mark = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const word = size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`${mark} overflow-hidden rounded-lg bg-[#0E0D0C] p-0.5`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src="/brand/touchstone.png" className="h-full w-full object-contain" />
      </span>
      <span className={`${word} font-bold tracking-tight text-[#0F0E0C] ${display}`}>Kasauti</span>
    </span>
  );
}
