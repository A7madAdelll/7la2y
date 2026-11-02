"use server";

import { headers } from "next/headers";
import { clientIpFrom } from "@/lib/client-ip";
import { performJoin, type JoinOutcome } from "@/lib/queue/join-core";
import type { JoinInput } from "@/lib/queue/types";
import { serverEnv } from "@/lib/server-env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

/** "احجز دوري": everything the browser sends is re-checked here and in the database. */
export async function joinShop(slug: string, input: JoinInput, botToken: string): Promise<JoinOutcome> {
  const ip = clientIpFrom(await headers());
  return performJoin(
    { slug: String(slug), input, botToken: String(botToken ?? ""), ip },
    {
      verifyBot: (token, remoteIp) => verifyTurnstile(token, serverEnv().turnstileSecretKey, remoteIp),
      callJoin: async (args) => {
        const { data, error } = await supabaseAdmin().rpc("join_queue", args);
        if (error) throw new Error(error.message);
        return data as { token?: string; ticket_no?: number; error?: string };
      },
    },
  );
}
