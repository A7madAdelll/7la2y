import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PosterSheet } from "@/components/settings/poster-sheet";
import { qrSvg } from "@/lib/qr";
import { siteOrigin } from "@/lib/site-origin";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "بوستر المحل — حلاقي", robots: { index: false } };

/**
 * Printable A5 poster. Printed from the browser ("Save as PDF" works too) instead of generating a
 * PDF on the server: browsers shape Arabic text correctly, most PDF libraries do not.
 */
export default function PosterPage({ params }: PageProps<"/settings/[shopId]/poster">) {
  return (
    <Suspense fallback={<p className="p-6 text-ink-soft">بيحمّل…</p>}>
      <Poster params={params} />
    </Suspense>
  );
}

async function Poster({ params }: { params: PageProps<"/settings/[shopId]/poster">["params"] }) {
  const { shopId } = await params;
  const { data: shop } = await (await supabaseServer()).from("shops").select("name, slug").eq("id", shopId).maybeSingle();
  if (!shop) notFound();
  const url = `${await siteOrigin()}/${shop.slug}`;
  const svg = await qrSvg(url);
  return <PosterSheet name={shop.name} url={url} svg={svg} />;
}
