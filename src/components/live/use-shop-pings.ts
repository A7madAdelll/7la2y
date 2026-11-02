"use client";

import { useEffect, useRef } from "react";

/**
 * Calls onChange when the shop's queue changes (Realtime broadcast "changed" on shop:<id>),
 * debounced, plus a safety refresh every 60s and whenever the tab becomes visible again
 * (phones suspend background tabs and can miss pings).
 * The Supabase client is loaded with import() after the page is shown: it is the largest
 * script on customer pages and is not needed to display them.
 */
export function useShopPings(shopId: string | null, onChange: () => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!shopId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 250);
    };
    let stopped = false;
    let cleanupChannel: (() => void) | undefined;
    void import("@/lib/supabase/browser").then(({ supabaseBrowser }) => {
      if (stopped) return;
      const client = supabaseBrowser();
      const channel = client.channel(`shop:${shopId}`).on("broadcast", { event: "changed" }, fire).subscribe();
      cleanupChannel = () => void client.removeChannel(channel);
    });
    const interval = setInterval(fire, 60_000);
    const onVisible = () => document.visibilityState === "visible" && fire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      cleanupChannel?.();
    };
  }, [shopId]);
}
