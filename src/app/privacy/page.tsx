import type { Metadata } from "next";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "سياسة الخصوصية — حلاقي" };

/**
 * DRAFT privacy notice under Egypt's Personal Data Protection Law 151/2020.
 * Must be reviewed by a lawyer before launch (company name, address, DPO contact).
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 p-5 pb-16 leading-relaxed">
      <h1 className="text-2xl font-bold">سياسة الخصوصية</h1>
      <Notice tone="warn">مسودة، هتتراجع قانونياً قبل الإطلاق.</Notice>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">بنجمع إيه؟</h2>
        <ul className="list-disc ps-5">
          <li>اسمك ورقم موبايلك والخدمة اللي اخترتها، لما تحجز دور في محل.</li>
          <li>عنوان الـ IP بتاعك لفترة قصيرة، عشان نمنع المحاولات الكتير والروبوتات.</li>
          <li>للمحلات: إيميل صاحب المحل والكاشير عشان الدخول.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">بنستخدمها في إيه؟</h2>
        <ul className="list-disc ps-5">
          <li>عشان المحل يعرف دورك ويناديك.</li>
          <li>لو اخترت، نبعتلك رسالة واتساب واحدة بس لما يقرب دورك.</li>
          <li>مش بنبيع بياناتك ومش بنبعتلك إعلانات.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">مين يشوفها؟</h2>
        <p>المحل اللي حجزت فيه بس. كل محل مايقدرش يشوف بيانات محل تاني. شاشة التلفزيون بتعرض الأرقام بس من غير أسماء.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">بنحتفظ بيها قد إيه؟</h2>
        <p>اسمك ورقمك بيتمسحوا تلقائياً بعد 90 يوم من آخر زيارة. بنفضل محتفظين بعدد الزيارات من غير أسماء عشان إحصائيات المحل.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">حقك</h2>
        <p>تقدر تمسح بياناتك في أي وقت من صفحة دورك («امسح بياناتي»)، أو تكلمنا: [بريد التواصل].</p>
      </section>

      <p className="text-sm text-ink-soft">[اسم الشركة والعنوان التجاري] · آخر تحديث: [التاريخ]</p>
    </main>
  );
}
