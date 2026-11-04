"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Notice, TextField } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { SLUG_RE, toSlug, toSlugTyping } from "@/lib/slug";
import { supabaseBrowser } from "@/lib/supabase/browser";

const KINDS = [
  ["men", "رجالي"],
  ["kids", "أطفال"],
  ["women", "حريمي"],
] as const;

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [kinds, setKinds] = useState<string[]>(["men", "kids"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slugOk = SLUG_RE.test(slug);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalSlug = toSlug(slug);
    setSlug(finalSlug);
    if (name.trim().length < 2 || !SLUG_RE.test(finalSlug) || kinds.length === 0) return setError("كمّل البيانات الأول.");
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabaseBrowser().rpc("create_shop", { p_slug: finalSlug, p_name: name.trim(), p_kinds: kinds });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    router.push(`/settings/${data as string}`);
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <TextField label="اسم المحل" placeholder="مثلاً: صالون النيل" value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label="رابط المحل (حروف إنجليزي)" dir="ltr" className="text-right" placeholder="salon-el-nil"
        value={slug} onChange={(e) => setSlug(toSlugTyping(e.target.value))} onBlur={() => setSlug(toSlug(slug))}
        hint={slug ? (slugOk ? `رابط الزباين هيخلص بـ /${slug}` : "من 3 لـ 40 حرف") : "ده اللي هيتطبع في الـ QR"} />
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[15px] font-medium">المحل بيخدم مين؟</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(([k, label]) => (
            <Chip key={k} selected={kinds.includes(k)} onClick={() => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]))}>{label}</Chip>
          ))}
        </div>
        <p className="text-sm text-ink-soft">هنضيف قايمة خدمات جاهزة تقدر تعدل أسعارها بعدين.</p>
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" block disabled={busy}>{busy ? "لحظة…" : "اعمل المحل"}</Button>
    </form>
  );
}
