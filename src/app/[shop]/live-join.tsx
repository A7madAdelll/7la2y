"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JoinForm } from "@/components/customer/join-form";
import { Turnstile, type TurnstileHandle } from "@/components/live/turnstile";
import type { ShopPublic } from "@/lib/queue/types";
import { joinShop } from "./actions";

export function LiveJoin({ slug, shop, siteKey }: { slug: string; shop: ShopPublic; siteKey: string }) {
  const router = useRouter();
  const [botToken, setBotToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);
  return (
    <>
      <JoinForm
        shop={shop}
        onJoin={async (input) => {
          const r = await joinShop(slug, input, botToken);
          turnstile.current?.reset(); // tokens are single-use
          if (!r.ok) throw new Error(r.error);
          try { localStorage.setItem(`7la2y:ticket:${slug}`, r.token); } catch { /* private mode */ }
          router.push(`/t/${r.token}`);
        }}
      />
      <div className="px-5 pb-6">
        <Turnstile ref={turnstile} siteKey={siteKey} onToken={setBotToken} />
      </div>
    </>
  );
}
