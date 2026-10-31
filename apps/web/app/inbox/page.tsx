"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { openSession } from "@/lib/prototype";

export default function Inbox() {
  const router = useRouter();
  useEffect(() => {
    openSession();
    router.replace("/workspace");
  }, [router]);
  return <main className="min-h-screen bg-[#FFFDFB]" />;
}
