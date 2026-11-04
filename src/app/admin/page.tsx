import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { AdminBoard, type AdminShop } from "./admin-board";

export const metadata: Metadata = { title: "الإدارة — حلاقي", robots: { index: false, follow: false } };

/** Platform admin (Ahmad). Access is checked again inside every admin database function. */
export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 pb-16">
      <h1 className="text-2xl font-bold">إدارة حلاقي</h1>
      <Suspense fallback={<p className="text-ink-soft">بيحمّل…</p>}>
        <Admin />
      </Suspense>
    </main>
  );
}

async function Admin() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/admin");
  const { data, error } = await supabase.rpc("admin_shops");
  if (error) return <Notice tone="error">الصفحة دي للإدارة بس.</Notice>;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  return <AdminBoard shops={(data ?? []) as AdminShop[]} today={today} />;
}
