"use client";

import { useCallback, useState } from "react";
import { EntryStatusView } from "@/components/customer/entry-status-view";
import { useShopPings } from "@/components/live/use-shop-pings";
import type { EntryStatus } from "@/lib/queue/types";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Live = EntryStatus & { shop_id: string };

export function LiveStatus({ token, initial }: { token: string; initial: Live }) {
  const [status, setStatus] = useState(initial);
  const active = status.status === "waiting" || status.status === "serving";

  const refresh = useCallback(async () => {
    const { data } = await supabaseBrowser().rpc("entry_status", { p_token: token });
    if (data) setStatus(data as Live);
  }, [token]);

  // Stop listening once the visit is over.
  useShopPings(active ? status.shop_id : null, refresh);

  return (
    <EntryStatusView
      status={status}
      onLeave={async () => {
        const { error } = await supabaseBrowser().rpc("leave_queue", { p_token: token });
        if (error) throw new Error("unknown");
        await refresh();
      }}
    />
  );
}
