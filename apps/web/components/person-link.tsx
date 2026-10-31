import Link from "next/link";

export function PersonLink({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] || "You";
  return (
    <Link href="/settings" className="inline-flex items-center gap-2 rounded-full py-1 pr-1 pl-3 hover:bg-[#FAF6F0]">
      <span className="text-[15px]">{first}</span>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0E0D0C] text-white">
        <span className="material-symbols-outlined text-[18px]">person</span>
      </span>
    </Link>
  );
}
