import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SettingsBoard, type SettingsBarber, type SettingsService, type SettingsShop } from "@/components/settings/settings-board";
import { Notice } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "إعدادات المحل — حلاقي", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SettingsPage({ params }: PageProps<"/settings/[shopId]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 p-5 pb-24">
      <Suspense fallback={<p className="text-ink-soft">بيحمّل…</p>}>
        <Settings params={params} />
      </Suspense>
    </main>
  );
}

async function Settings({ params }: { params: PageProps<"/settings/[shopId]">["params"] }) {
  const { shopId } = await params;
  if (!UUID.test(shopId)) notFound();
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/settings/${shopId}`);

  // RLS returns nothing for shops this account is not a member of.
  const [shop, member, barbers, services] = await Promise.all([
    supabase.from("shops").select("id, name, slug, kinds, queue_open").eq("id", shopId).maybeSingle(),
    supabase.from("shop_members").select("role").eq("shop_id", shopId).eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("barbers").select("id, name, active, on_duty").eq("shop_id", shopId).order("sort").order("created_at"),
    supabase.from("services").select("id, name, category, kind, price_egp, minutes, active").eq("shop_id", shopId).order("sort"),
  ]);
  if (!shop.data) notFound();
  if (member.data?.role !== "owner") {
    return <Notice>الإعدادات لصاحب المحل بس.</Notice>;
  }
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm text-ink-soft">إعدادات</span>
          <h1 className="text-2xl font-bold">{shop.data.name}</h1>
        </div>
        <Link href={`/counter/${shopId}`} className="flex min-h-11 items-center rounded-[14px] bg-brand px-4 font-bold text-white hover:bg-brand-strong">
          شاشة الكاشير
        </Link>
      </header>
      <SettingsBoard shop={shop.data as SettingsShop} barbers={(barbers.data ?? []) as SettingsBarber[]}
        services={(services.data ?? []) as SettingsService[]} />
    </>
  );
}
