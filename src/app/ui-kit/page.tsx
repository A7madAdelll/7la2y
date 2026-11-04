import type { Metadata } from "next";
import { Button, Card, Notice, TextField, Ticket } from "@/components/ui";
import { ERROR_MESSAGES } from "@/lib/errors";
import { formatEGP, formatMinutes, formatPeople } from "@/lib/format";
import { DemoPicker } from "./demo-picker";

// Living reference for the design system (Phase 2). No data, no secrets.
export const metadata: Metadata = { title: "مكونات حلاقي", robots: { index: false } };

const SWATCHES = [
  ["paper", "bg-paper"],
  ["surface", "bg-surface"],
  ["ink", "bg-ink"],
  ["brand", "bg-brand"],
  ["brand-tint", "bg-brand-tint"],
  ["warn-tint", "bg-warn-tint"],
  ["danger", "bg-danger"],
] as const;

export default function UiKit() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-bold">مكونات حلاقي</h1>
        <p className="text-ink-soft">كل الألوان والأزرار والخانات اللي هنبني بيها الشاشات.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">الألوان</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1 text-xs">
              <span className={`h-12 rounded-lg border border-line ${cls}`} />
              <span dir="ltr" className="text-ink-soft">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">الأزرار</h2>
        <Button block size="lg">احجز دوري</Button>
        <div className="grid grid-cols-3 gap-2.5">
          <Button size="xl" className="col-span-2">التالي ←</Button>
          <Button size="xl" variant="secondary" className="text-base font-medium">مجاش</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md">+ زبون من غير موبايل</Button>
          <Button variant="danger" size="md">اخرج من الدور</Button>
          <Button size="md" disabled>مقفول</Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">الخانات</h2>
        <TextField label="اسمك" placeholder="مثلاً: أحمد" autoComplete="given-name" />
        <TextField
          label="رقم الموبايل"
          type="tel"
          inputMode="numeric"
          dir="ltr"
          className="text-right"
          placeholder="01xxxxxxxxx"
          error={ERROR_MESSAGES.invalid_phone}
        />
        <TextField
          label="كود المحل"
          inputMode="numeric"
          dir="ltr"
          maxLength={4}
          placeholder="• • • •"
          className="text-center text-[28px] tracking-[14px]"
          hint="مكتوب على شاشة الكاشير والتلفزيون جوه المحل."
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">الاختيارات</h2>
        <DemoPicker />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">الرسايل</h2>
        <Notice tone="warn">هنبعتلك واتساب لما يفضل قدامك 2. تقدر تخرج وترجع.</Notice>
        <Notice tone="error">{ERROR_MESSAGES.bad_code}</Notice>
        <Notice>الطابور مفتوح.</Notice>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">الدور</h2>
        <Ticket number={14} />
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col gap-1">
            <span className="text-sm text-ink-soft">قدامك</span>
            <span className="text-2xl font-bold">{formatPeople(3)}</span>
          </Card>
          <Card className="flex flex-col gap-1">
            <span className="text-sm text-ink-soft">الانتظار تقريباً</span>
            <span className="text-2xl font-bold">{formatMinutes(35)}</span>
          </Card>
        </div>
        <Card className="flex justify-between">
          <span>قصة + دقن</span>
          <span>{formatEGP(null)}</span>
        </Card>
      </section>
    </main>
  );
}
