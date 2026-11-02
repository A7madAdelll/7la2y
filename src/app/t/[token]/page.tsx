import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { EntryStatus } from "@/lib/queue/types";
import { supabaseAnonServer } from "@/lib/supabase/anon-server";
import { LiveStatus } from "./live-status";

// Private ticket link: never indexed, never sent as a referrer (strict-origin header).
export const metadata: Metadata = { title: "دورك — حلاقي", robots: { index: false, follow: false } };

export default function TicketPage({ params }: PageProps<"/t/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col">
      <Suspense fallback={<p className="p-6 text-ink-soft">بيحمّل…</p>}>
        <TicketContent params={params} />
      </Suspense>
    </main>
  );
}

async function TicketContent({ params }: { params: PageProps<"/t/[token]">["params"] }) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();
  const { data } = await supabaseAnonServer().rpc("entry_status", { p_token: token });
  if (!data) notFound();
  const initial = data as EntryStatus & { shop_id: string };
  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-5 py-4.5">
        <span className="font-bold">{initial.shop_name}</span>
        <span className="flex items-center gap-1.5 text-[13px] text-ink-soft">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" /> مباشر
        </span>
      </header>
      <LiveStatus token={token} initial={initial} />
    </>
  );
}
