"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";

export function Bar({ email, company }: { email?: string; company?: string }) {
  const router = useRouter();
  return (
    <header className="flex items-baseline justify-between py-7">
      <Link href="/workspace" className="flex items-center gap-3">
        <Logo size="sm" />
        {company ? <span className="text-[14px] text-muted">{company}</span> : null}
      </Link>
      <div className="flex items-baseline gap-5 text-[13px] text-muted">
        {email ? <span>{email}</span> : null}
        <button type="button" onClick={() => router.push("/")}>
          Home
        </button>
      </div>
    </header>
  );
}
