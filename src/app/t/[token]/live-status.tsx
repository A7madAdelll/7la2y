"use client";

import { useCallback, useState } from "react";
import { EntryStatusView } from "@/components/customer/entry-status-view";
import { useShopPings } from "@/components/live/use-shop-pings";
import type { EntryStatus } from "@/lib/queue/types";

type Live = EntryStatus & { shop_id: string };

/** Our WhatsApp business number in international digits (e.g. 2010...). Unset = no confirm button. */
const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

/** Loaded on demand so the ticket page renders without the Supabase client in its first bundle. */
const db = async () => (await import("@/lib/supabase/browser")).supabaseBrowser();

export function LiveStatus({ token, initial }: { token: string; initial: Live }) {
  const [status, setStatus] = useState(initial);
  const active = status.status === "waiting" || status.status === "serving";

  const refresh = useCallback(async () => {
    const { data } = await (await db()).rpc("entry_status", { p_token: token });
    if (data) setStatus(data as Live);
  }, [token]);

  // Stop listening once the visit is over.
  useShopPings(active ? status.shop_id : null, refresh);

  return (
    <EntryStatusView
      status={status}
      onLeave={async () => {
        const { error } = await (await db()).rpc("leave_queue", { p_token: token });
        if (error) throw new Error("unknown");
        await refresh();
      }}
      onConfirmWhatsApp={WHATSAPP_NUMBER ? async () => {
        const { data, error } = await (await db()).rpc("request_whatsapp_confirm", { p_token: token });
        if (error) throw new Error(error.message);
        const r = data as { code?: string; already?: boolean };
        if (r.already || !r.code) return void (await refresh());
        // Prefilled message to our business number; sending it from their phone is the proof.
        const text = `تأكيد دوري في ${status.shop_name}: ${r.code}`;
        window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
      } : undefined}
      onForget={async () => {
        const { error } = await (await db()).rpc("forget_me", { p_token: token });
        if (error) throw new Error("unknown");
        try { for (const k of Object.keys(localStorage)) if (k.startsWith("7la2y:ticket:")) localStorage.removeItem(k); } catch { /* private mode */ }
        await refresh();
      }}
    />
  );
}
