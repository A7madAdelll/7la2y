"use client";

import { useCallback, useState } from "react";
import { CounterBoard } from "@/components/counter/counter-board";
import { useShopPings } from "@/components/live/use-shop-pings";
import { Notice } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import type { CounterState } from "@/lib/queue/types";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type Live = CounterState & { default_service_id: string | null };

export function LiveCounter({ shopId, initial, initialError }: { shopId: string; initial: Live | null; initialError: string | null }) {
  const [state, setState] = useState<Live | null>(initial);
  const [error, setError] = useState<string | null>(initialError);

  const refresh = useCallback(async () => {
    const { data, error: e } = await supabaseBrowser().rpc("counter_state", { p_shop_id: shopId });
    if (e) setError(errorMessage(e));
    else { setState(data as Live); setError(null); }
  }, [shopId]);

  useShopPings(shopId, refresh);

  /** Every action is one database function; the screen then refreshes (also via the ping). */
  const run = (fn: string, args: Record<string, unknown>) => async () => {
    const { error: e } = await supabaseBrowser().rpc(fn, args);
    if (e) setError(errorMessage(e));
    await refresh();
  };

  if (!state) return error ? <div className="p-5"><Notice tone="error">{error}</Notice></div> : <p className="p-6 text-ink-soft">بيحمّل…</p>;

  return (
    <>
      {error && <div className="fixed inset-x-4 bottom-4 z-10"><Notice tone="error">{error}</Notice></div>}
      <CounterBoard
        state={state}
        onNext={(barberId, expectedCurrent) => void run("queue_next", { p_barber_id: barberId, p_expected_current: expectedCurrent })()}
        onNoShow={(entryId) => void run("queue_no_show", { p_entry_id: entryId })()}
        onMove={(entryId, delta) => {
          const ids = state.waiting.map((w) => w.id);
          const i = ids.indexOf(entryId);
          // queue_reorder puts the entry BEFORE another one (null = to the end).
          const before = delta === -1 ? ids[i - 1] : (ids[i + 2] ?? null);
          if (i < 0 || (delta === -1 && i === 0)) return;
          void run("queue_reorder", { p_entry_id: entryId, p_before_entry_id: before })();
        }}
        onWalkIn={(name) =>
          state.default_service_id &&
          void run("staff_add_walk_in", { p_shop_id: shopId, p_name: name, p_barber_id: null, p_service_ids: [state.default_service_id] })()
        }
        onToggleOpen={() => void run("set_queue_open", { p_shop_id: shopId, p_open: !state.shop.queue_open })()}
        onToggleDuty={(barberId) => {
          const b = state.barbers.find((x) => x.id === barberId);
          void run("set_barber_on_duty", { p_barber_id: barberId, p_on_duty: !b?.on_duty })();
        }}
      />
    </>
  );
}
