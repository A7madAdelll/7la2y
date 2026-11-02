import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { errorMessage } from "@/lib/errors";
import { supabaseServer } from "@/lib/supabase/server";
import { LiveCounter, type Live } from "./live-counter";

export const metadata: Metadata = { title: "شاشة الكاشير — حلاقي", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CounterPage({ params }: PageProps<"/counter/[shopId]">) {
  return (
    <Suspense fallback={<p className="p-6 text-ink-soft">بيحمّل…</p>}>
      <Counter params={params} />
    </Suspense>
  );
}

async function Counter({ params }: { params: PageProps<"/counter/[shopId]">["params"] }) {
  const { shopId } = await params;
  if (!UUID.test(shopId)) notFound();
  // First render on the server with the staff session; the browser then follows live pings.
  const { data, error } = await (await supabaseServer()).rpc("counter_state", { p_shop_id: shopId });
  return <LiveCounter shopId={shopId} initial={(data as Live | null) ?? null} initialError={error ? errorMessage(error) : null} />;
}
