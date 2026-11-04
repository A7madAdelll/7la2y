import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { TvData } from "@/lib/queue/types";
import { Qr } from "@/components/ui";
import { qrSvg } from "@/lib/qr";
import { siteOrigin } from "@/lib/site-origin";
import { supabaseAnonServer } from "@/lib/supabase/anon-server";
import { LiveTv } from "./live-tv";

// Secret per-shop link for the waiting-room TV (owner can rotate it). Never indexed.
export const metadata: Metadata = { title: "شاشة المحل — حلاقي", robots: { index: false, follow: false } };

export default function TvPage({ params }: PageProps<"/tv/[token]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <Tv params={params} />
    </Suspense>
  );
}

async function Tv({ params }: { params: PageProps<"/tv/[token]">["params"] }) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();
  const { data } = await supabaseAnonServer().rpc("tv_board", { p_tv_token: token });
  const initial = (data as TvData | null) ?? null;
  // The shop link never changes, so the QR is drawn once on the server.
  const qr = initial?.slug ? <Qr svg={await qrSvg(`${await siteOrigin()}/${initial.slug}`)} label="QR المحل" className="w-[220px]" /> : undefined;
  return <LiveTv token={token} initial={initial} qr={qr} />;
}
