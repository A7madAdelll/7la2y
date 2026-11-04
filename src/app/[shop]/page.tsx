import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopHeader } from "@/components/customer/shop-header";
import { publicEnv } from "@/lib/env";
import type { ShopPublic } from "@/lib/queue/types";
import { supabaseAnonServer } from "@/lib/supabase/anon-server";
import { LiveJoin } from "./live-join";

export const metadata: Metadata = { robots: { index: false } };

const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** /<shop-link>: the page the shop's QR code opens. */
export default function ShopPage({ params }: PageProps<"/[shop]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col">
      <Suspense fallback={<p className="p-6 text-ink-soft">بيحمّل…</p>}>
        <ShopContent params={params} />
      </Suspense>
    </main>
  );
}

async function ShopContent({ params }: { params: PageProps<"/[shop]">["params"] }) {
  const { shop: raw } = await params;
  const slug = decodeURIComponent(raw).toLowerCase();
  if (!SLUG.test(slug)) notFound();
  const { data, error } = await supabaseAnonServer().rpc("shop_public", { p_slug: slug });
  if (error) throw new Error("shop_public failed"); // error.tsx shows a friendly message
  if (!data) notFound();
  const shop = data as ShopPublic;
  return (
    <>
      <ShopHeader shop={shop} />
      <LiveJoin slug={slug} shop={shop} siteKey={publicEnv().turnstileSiteKey} />
    </>
  );
}
