import { NextResponse } from "next/server";

// STUB: swap this for a real store (Resend, a DB table, Airtable, etc.) before launch.
// It only validates and echoes back so the form works end to end today.
export async function POST(request: Request) {
  let body: { email?: string; phone?: string; note?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const note = (body.note ?? "").trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return NextResponse.json({ ok: false, error: "Enter a work email." }, { status: 422 });
  }

  // PLACEHOLDER: this just logs. No email is sent and nothing is stored yet.
  console.log("[waitlist] early access request", { email, phone: phone || null, note: note || null });

  return NextResponse.json({ ok: true });
}
