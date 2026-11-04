"use client";

import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Calls onChange when the shop's queue changes (Realtime broadcast "changed" on shop:<id>),
 * debounced, plus a safety refresh every 60s and whenever the tab becomes visible again
 * (phones suspend background tabs and can miss pings).
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
    const channel = supabaseBrowser()
      .channel(`shop:${shopId}`)
      .on("broadcast", { event: "changed" }, fire)
      .subscribe();
    const interval = setInterval(fire, 60_000);
    const onVisible = () => document.visibilityState === "visible" && fire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      void supabaseBrowser().removeChannel(channel);
    };
  }, [shopId]);
}
