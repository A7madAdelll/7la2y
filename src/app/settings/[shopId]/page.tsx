import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SettingsBoard, type SettingsBarber, type SettingsService, type SettingsShop } from "@/components/settings/settings-board";
import { LinksSection, type Staff } from "@/components/settings/links-section";
import { Notice, Qr } from "@/components/ui";
import { qrSvg } from "@/lib/qr";
import { siteOrigin } from "@/lib/site-origin";
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
    supabase.from("shops").select("id, name, slug, kinds, queue_open, no_show_minutes, require_code").eq("id", shopId).maybeSingle(),
    supabase.from("shop_members").select("role").eq("shop_id", shopId).eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("barbers").select("id, name, active, on_duty").eq("shop_id", shopId).order("sort").order("created_at"),
    supabase.from("services").select("id, name, category, kind, price_egp, minutes, active").eq("shop_id", shopId).order("sort"),
  ]);
  if (!shop.data) notFound();
  if (member.data?.role !== "owner") {
    return <Notice>الإعدادات لصاحب المحل بس.</Notice>;
  }
  const origin = await siteOrigin();
  const shopUrl = `${origin}/${shop.data.slug}`;
  const [svg, staff] = await Promise.all([
    qrSvg(shopUrl),
    supabase.rpc("shop_staff", { p_shop_id: shopId }),
  ]);
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
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">رابط المحل والـ QR</h2>
        <div className="flex items-center gap-4 rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface p-4">
          <Qr svg={svg} label={`QR لرابط ${shopUrl}`} className="size-28 shrink-0" />
          <div className="flex min-w-0 flex-col gap-2">
            <code dir="ltr" className="text-sm break-all">{shopUrl}</code>
            <Link href={`/settings/${shopId}/poster`} className="flex min-h-11 items-center justify-center rounded-[14px] border-[1.5px] border-brand px-4 font-bold text-brand hover:bg-brand-tint">
              اطبع البوستر (A5)
            </Link>
          </div>
        </div>
      </section>
      <SettingsBoard shop={shop.data as SettingsShop} barbers={(barbers.data ?? []) as SettingsBarber[]}
        services={(services.data ?? []) as SettingsService[]} />
      <LinksSection shopId={shopId} origin={origin} staff={(staff.data ?? []) as Staff[]} />
    </>
  );
}
