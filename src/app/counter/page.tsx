import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";

/** /counter: pick the shop (or go straight in when the account has one). */
export default function CounterIndex() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
      <Suspense fallback={<p className="text-ink-soft">بيحمّل…</p>}>
        <Shops />
      </Suspense>
    </main>
  );
}

async function Shops() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data } = await supabase
    .from("shop_members")
    .select("shop_id, role, shops(name)")
    .eq("user_id", auth.user.id);
  const shops = (data ?? []) as unknown as { shop_id: string; role: string; shops: { name: string } | null }[];
  if (shops.length === 1) redirect(`/counter/${shops[0].shop_id}`);
  if (shops.length === 0) {
    return (
      <>
        <Notice>الحساب ده مش مربوط بأي محل لسه. لو إنت كاشير، اطلب من صاحب المحل يبعتلك دعوة.</Notice>
        <Link href="/onboarding" className="flex min-h-13 items-center justify-center rounded-[14px] bg-brand px-4 font-bold text-white hover:bg-brand-strong">
          أنا صاحب محل: اعمل محل جديد
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold">اختار المحل</h1>
      {shops.map((s) => (
        <Link key={s.shop_id} href={`/counter/${s.shop_id}`}
          className="flex min-h-13 items-center rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface px-4 font-medium text-ink hover:border-ink">
          {s.shops?.name ?? "محل"}
        </Link>
      ))}
    </>
  );
}
