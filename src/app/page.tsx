import type { Metadata } from "next";
import Link from "next/link";
import { Ticket } from "@/components/ui";

/**
 * Landing page, one page for both audiences: people waiting for a haircut and shop owners.
 * Server-only markup (no client component), so it stays light on cheap phones.
 * Copy must match the product rules in CLAUDE.md: joining happens in the shop only (QR + code),
 * WhatsApp is one opt-in message, data is erased after 90 days, pricing is 1 EGP per haircut.
 */
export const metadata: Metadata = {
  title: "حلاقي — احجز دورك في الحلاق من غير ما تستنى واقف",
  description:
    "امسح الـQR في المحل، خد رقمك واتمشى، وارجع لما دورك يقرب. ولصاحب المحل: طابور منظم وشاشة كاشير بجنيه واحد على الحلاقة.",
};

const CUSTOMER_STEPS = [
  { title: "امسح الـQR في المحل", body: "من كاميرا موبايلك. مش محتاج تنزّل أبليكيشن ولا تعمل حساب." },
  { title: "اكتب الكود واختار طلبك", body: "الكود على شاشة المحل. هتشوف الأسعار والمدة قبل ما تحجز." },
  { title: "خد رقمك واتمشى", body: "الصفحة بتتحدث لوحدها، ولو عايز نبعتلك رسالة واتساب واحدة لما يفضل قدامك اتنين." },
] as const;

const OWNER_POINTS = [
  { title: "الزبون مش هيمشي من الزحمة", body: "بياخد رقمه ويرجع في ميعاده بدل ما يزهق من الوقفة ويروح لحد تاني." },
  { title: "شاشة كاشير بسيطة", body: "«نده التالي» و«مجاش» بضغطة. وشاشة للتلفزيون فيها الأرقام بس، من غير أسماء." },
  { title: "قايمتك وأسعارك", body: "خدماتك وإضافاتك وباكدجاتك، وحتى الشاي والقهوة. إنت اللي بتحدد السعر والمدة." },
  { title: "يشتغل من موبايلك", body: "لو شغال لوحدك، الموبايل يكفي. ومعاك كاشير؟ ابعتله دعوة على إيميله." },
] as const;

const FAQ = [
  { q: "ينفع أحجز وأنا في البيت؟", a: "لأ، الحجز من جوه المحل بس، بالكود اللي على الشاشة. كده الدور عادل للي واقفين فعلاً." },
  { q: "هتعملوا إيه برقم موبايلي؟", a: "بيستخدم لدورك بس، ومش بنبعت غير رسالة واحدة لو طلبتها. بيتمسح بعد 90 يوم من آخر زيارة، وتقدر تمسحه بنفسك في أي وقت." },
  { q: "الاشتراك بكام لصاحب المحل؟", a: "مفيش اشتراك شهري. جنيه واحد على كل حلاقة بتخلص عن طريق حلاقي، ولو اليوم واقف مبتدفعش حاجة." },
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-ink text-paper">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <span className="text-xl font-bold">حلاقي</span>
          <Link href="/login" className="rounded-[var(--radius-control)] px-3 py-2 text-[15px] font-medium text-[#c9cdd2] hover:text-paper">
            دخول المحل
          </Link>
        </div>

        <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-5 pt-6 pb-14 md:grid-cols-[1.2fr_1fr] md:pt-12 md:pb-20">
          <div className="flex flex-col gap-5">
            <h1 className="text-[34px] leading-[1.25] font-bold md:text-5xl md:leading-[1.2]">
              دورك محفوظ،
              <br />
              <span className="text-[#7fd1cc]">من غير ما تستنى واقف.</span>
            </h1>
            <p className="max-w-md text-[17px] leading-relaxed text-[#c9cdd2]">
              طابور الحلاق على موبايلك. تاخد رقمك في المحل، تتمشى أو تقعد على القهوة، وترجع لما دورك يقرب.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="#customers" className="flex min-h-13 items-center justify-center rounded-[14px] bg-paper px-5 font-bold text-ink hover:bg-white">
                أنا رايح أحلق
              </a>
              <a href="#owners" className="flex min-h-13 items-center justify-center rounded-[14px] border-[1.5px] border-[#4a5866] px-5 font-bold text-paper hover:border-paper">
                أنا صاحب محل
              </a>
            </div>
          </div>

          <TicketPreview />
        </section>
      </header>

      <main className="flex flex-col">
        <section id="customers" aria-labelledby="customers-title" className="scroll-mt-4 px-5 py-14 md:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <SectionHeading id="customers-title" eyebrow="للي رايح يحلق" title="3 خطوات وتبقى في الدور" />
            <ol className="grid gap-4 md:grid-cols-3">
              {CUSTOMER_STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-5">
                  <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-brand-tint font-bold text-brand tabular-nums">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <p className="text-ink-soft leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="owners" aria-labelledby="owners-title" className="scroll-mt-4 border-y border-line bg-surface px-5 py-14 md:py-20">
          <div className="mx-auto grid w-full max-w-5xl gap-10 md:grid-cols-[1fr_1.3fr]">
            <div className="flex flex-col gap-5">
              <SectionHeading id="owners-title" eyebrow="لصاحب المحل" title="محلك مليان، والزحمة متنظمة" />
              <div className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-brand-tint p-5">
                <span className="text-[15px] text-brand-strong">السعر</span>
                <span className="text-[28px] leading-tight font-bold text-ink">جنيه واحد على الحلاقة</span>
                <span className="text-ink-soft">من غير اشتراك شهري ومن غير أجهزة.</span>
              </div>
              <Link href="/onboarding" className="flex min-h-13 items-center justify-center rounded-[14px] bg-brand px-5 font-bold text-white hover:bg-brand-strong">
                اعمل محلك في دقيقة
              </Link>
              <p className="text-[14px] text-ink-soft">
                عندك حساب؟{" "}
                <Link href="/login" className="font-medium text-brand underline underline-offset-4">
                  ادخل من هنا
                </Link>
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {OWNER_POINTS.map((p) => (
                <li key={p.title} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-paper p-5">
                  <h3 className="text-lg font-bold">{p.title}</h3>
                  <p className="text-ink-soft leading-relaxed">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq-title" className="px-5 py-14 md:py-20">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <h2 id="faq-title" className="text-2xl font-bold md:text-3xl">أسئلة بتتسأل كتير</h2>
            <div className="flex flex-col gap-3">
              {FAQ.map((f) => (
                <details key={f.q} className="group rounded-[var(--radius-card)] border border-line bg-surface">
                  <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-bold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden="true" className="text-xl text-ink-soft transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-5 pb-5 leading-relaxed text-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 text-[14px] text-ink-soft">
          <span>حلاقي · طابور الحلاقة</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">الخصوصية</Link>
            <Link href="/login" className="hover:text-ink">دخول المحل</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] font-medium text-brand">{eyebrow}</span>
      <h2 id={id} className="text-2xl font-bold md:text-3xl">{title}</h2>
    </div>
  );
}

/** A static picture of the customer's ticket screen, built from the real Ticket component. */
function TicketPreview() {
  return (
    <figure aria-label="شكل صفحة الدور عند الزبون" className="mx-auto w-full max-w-[300px] rounded-[28px] bg-paper p-3 text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between px-2 pt-1 pb-3">
        <span className="font-bold">صالون النيل</span>
        <span className="flex items-center gap-1.5 text-[13px] text-ink-soft">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" /> مباشر
        </span>
      </div>
      <Ticket number={14} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-3">
          <span className="text-[13px] text-ink-soft">قدامك</span>
          <span className="text-xl font-bold">2</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-3">
          <span className="text-[13px] text-ink-soft">الانتظار تقريباً</span>
          <span className="text-xl font-bold">25 دقيقة</span>
        </div>
      </div>
      <div className="mt-3 rounded-[var(--radius-card)] border border-warn-line bg-warn-tint p-3 text-[14px] text-warn">
        قرّب دورك. ارجع للمحل دلوقتي.
      </div>
    </figure>
  );
}
