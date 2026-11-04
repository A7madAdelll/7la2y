import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "دعوة كاشير — حلاقي", robots: { index: false, follow: false } };

/** Cashier invite link. Login is required (proxy.ts), then the invite is accepted once. */
export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-5 pt-10">
      <Suspense fallback={<p className="text-ink-soft">بيحمّل…</p>}>
        <Accept params={params} />
      </Suspense>
    </main>
  );
}

async function Accept({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();
  const { data, error } = await (await supabaseServer()).rpc("accept_invite", { p_token: token });
  if (error) return <Notice tone="error">{errorMessage(error)}</Notice>;
  redirect(`/counter/${data as string}`);
}
