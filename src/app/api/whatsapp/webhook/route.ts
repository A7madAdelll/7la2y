import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseStatuses, verifyMetaSignature } from "@/lib/whatsapp/meta";

/** Meta's one-time subscription check: echo hub.challenge if hub.verify_token matches ours. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  const given = p.get("hub.verify_token") ?? "";
  const ok =
    p.get("hub.mode") === "subscribe" && expected.length > 0 && given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  return ok ? new NextResponse(p.get("hub.challenge") ?? "", { status: 200 }) : new NextResponse("forbidden", { status: 403 });
}

/** Delivery receipts. Signature checked on the RAW body before anything is parsed or stored. */
export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const raw = await request.text();
  if (!secret || !verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("invalid signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const db = supabaseAdmin();
  for (const u of parseStatuses(body)) {
    const { error } = await db.rpc("record_message_status", { p_provider_message_id: u.id, p_status: u.status, p_error: u.error ?? null });
    if (error) console.error("record_message_status failed", error.message);
  }
  return NextResponse.json({ ok: true }); // always 200 once verified, so Meta does not retry forever
}
