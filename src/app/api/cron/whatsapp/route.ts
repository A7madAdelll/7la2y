import { NextResponse, type NextRequest } from "next/server";
import { hasBearer } from "@/lib/bearer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { whatsappConfig } from "@/lib/whatsapp/config";
import { sendTemplate } from "@/lib/whatsapp/meta";
import { runOutbox, type Claimed } from "@/lib/whatsapp/outbox";

/** Called every minute by Vercel Cron (vercel.json) with "Authorization: Bearer $CRON_SECRET". */
export async function GET(request: NextRequest) {
  if (!hasBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cfg = whatsappConfig();
  if (!cfg) return NextResponse.json({ skipped: "whatsapp_not_configured" });

  const db = supabaseAdmin();
  const result = await runOutbox({
    claim: async (limit) => {
      const { data, error } = await db.rpc("claim_messages", { p_limit: limit });
      if (error) throw new Error(`claim_messages: ${error.message}`);
      return (data ?? []) as Claimed[];
    },
    send: (to, params) => sendTemplate(cfg, to, params),
    complete: async (id, r) => {
      const { error } = await db.rpc("complete_message", {
        p_id: id,
        p_ok: r.ok,
        p_provider_message_id: r.ok ? r.id : null,
        p_error: r.ok ? null : r.error,
        p_retry: !r.ok && r.retry,
      });
      if (error) console.error("complete_message failed", id, error.message);
    },
  });
  if (result.failed > 0) console.warn("whatsapp outbox run had failures", result);
  return NextResponse.json(result);
}
