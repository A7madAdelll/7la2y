"use client";

import { useCallback, useEffect, useState } from "react";
import { useShopPings } from "@/components/live/use-shop-pings";
import { TvBoard } from "@/components/tv/tv-board";
import type { TvData } from "@/lib/queue/types";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LiveTv({ token, initial }: { token: string; initial: TvData | null }) {
  const [data, setData] = useState<TvData | null>(initial);
  const refresh = useCallback(async () => {
    const { data: d, error } = await supabaseBrowser().rpc("tv_board", { p_tv_token: token });
    if (!error) setData((d as TvData | null) ?? null);
  }, [token]);

  useShopPings(data?.shop_id ?? null, refresh);

  // The code rotates every 5 minutes: refresh right after it expires.
  useEffect(() => {
    if (!data) return;
    const ms = Math.max(1000, new Date(data.expires_at).getTime() - Date.now() + 1500);
    const t = setTimeout(() => void refresh(), ms);
    return () => clearTimeout(t);
  }, [data, refresh]);

  if (data === null) {
    return <p className="grid min-h-dvh place-items-center bg-ink p-8 text-center text-2xl text-paper">لينك الشاشة ده اتغير. خد اللينك الجديد من إعدادات المحل.</p>;
  }
  return <TvBoard data={data} />;
}
