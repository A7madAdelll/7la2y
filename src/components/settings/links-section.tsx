"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Notice, TextField } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type Staff = { user_id: string; email: string | null; role: "owner" | "cashier"; is_me: boolean };

const waShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** TV link (shown once after creating), cashier invites and staff list. */
export function LinksSection({ shopId, origin, staff }: { shopId: string; origin: string; staff: Staff[] }) {
  const router = useRouter();
  const [tvLink, setTvLink] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const db = supabaseBrowser();

  return (
    <div className="flex flex-col gap-6">
      {error && <Notice tone="error">{error}</Notice>}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">شاشة التلفزيون</h2>
        <Card className="flex flex-col gap-3">
          <p className="text-[15px] text-ink-soft">افتح اللينك ده على التلفزيون أو تابلت في المحل. بيعرض الأرقام والكود بس، من غير أسماء.</p>
          {tvLink ? (
            <>
              <code dir="ltr" className="rounded-lg bg-paper p-3 text-sm break-all">{tvLink}</code>
              <Notice tone="warn">احفظ اللينك ده دلوقتي، مش هيظهر تاني. لو اتسرب اعمل لينك جديد والقديم يقف.</Notice>
            </>
          ) : null}
          <Button variant="outline" size="md" onClick={async () => {
            if (tvLink === null && !confirm("لو في لينك قديم شغال على التلفزيون هيقف. تكمل؟")) return;
            const { data, error: e } = await db.rpc("rotate_tv_link", { p_shop_id: shopId });
            if (e) return setError(errorMessage(e));
            setTvLink(`${origin}/tv/${data as string}`);
          }}>
            {tvLink ? "اعمل لينك تاني" : "اعمل لينك للتلفزيون"}
          </Button>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">الكاشير</h2>
        {staff.map((m) => (
          <Card key={m.user_id} className="flex items-center justify-between gap-2">
            <span className="flex flex-col">
              <span dir="ltr" className="text-right">{m.email ?? "—"}</span>
              <span className="text-[13px] text-ink-soft">{m.role === "owner" ? "صاحب المحل" : "كاشير"}{m.is_me ? " · إنت" : ""}</span>
            </span>
            {m.role === "cashier" && (
              <Button variant="danger" size="md" onClick={async () => {
                if (!confirm("تشيل الكاشير ده من المحل؟")) return;
                const { error: e } = await db.rpc("remove_cashier", { p_shop_id: shopId, p_user_id: m.user_id });
                if (e) setError(errorMessage(e)); else router.refresh();
              }}>شيله</Button>
            )}
          </Card>
        ))}
        <form noValidate className="flex flex-col gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const { data, error: err } = await db.rpc("create_invite", { p_shop_id: shopId, p_email: inviteEmail });
          if (err) return setError(errorMessage(err));
          setError(null);
          setInviteLink(`${origin}/invite/${data as string}`);
        }}>
          <TextField label="إيميل الكاشير" type="email" dir="ltr" className="text-right" value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)} hint="هيدخل بنفس الإيميل ده. الدعوة صالحة 7 أيام ولمرة واحدة." />
          <Button type="submit" size="md" variant="outline">اعمل دعوة</Button>
        </form>
        {inviteLink && (
          <Card className="flex flex-col gap-3">
            <code dir="ltr" className="rounded-lg bg-paper p-3 text-sm break-all">{inviteLink}</code>
            <a href={waShare(`دعوة لشاشة الكاشير في حلاقي: ${inviteLink}`)} target="_blank" rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center rounded-[14px] bg-brand px-4 font-bold text-white hover:bg-brand-strong">
              ابعتها واتساب
            </a>
          </Card>
        )}
      </section>
    </div>
  );
}
