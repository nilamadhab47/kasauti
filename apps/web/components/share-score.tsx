"use client";

import { useEffect, useState } from "react";

const mono = "[font-family:var(--font-mono)]";

export function ShareScore({ slug, badge }: { slug: string; badge: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"link" | "badge" | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const page = origin ? `${origin}/score/${slug}` : `/score/${slug}`;
  const image = origin ? `${origin}/score/${slug}/badge` : `/score/${slug}/badge`;
  const embed = `<a href="${page}"><img src="${image}" alt="${badge}" /></a>`;

  async function copy(kind: "link" | "badge", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className={`text-[11px] tracking-[0.12em] text-[#8C7263] uppercase ${mono}`}>Share</p>
      <p className="mt-2 text-[15px] leading-6 text-[#584235]">{badge}</p>
      {origin ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${origin}/score/${slug}/badge`} alt={badge} className="mt-4 h-12 w-auto max-w-full" />
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("link", page)} className={`rounded-lg bg-[#1E1B19] px-4 py-2 text-[13px] text-white ${mono}`}>
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
        <button type="button" onClick={() => copy("badge", embed)} className={`rounded-lg bg-[#F4ECE8] px-4 py-2 text-[13px] text-[#1E1B19] ${mono}`}>
          {copied === "badge" ? "Copied" : "Copy badge"}
        </button>
      </div>
      <p className={`mt-4 break-all text-[12px] leading-5 text-[#8C7263] ${mono}`}>{embed}</p>
    </div>
  );
}
