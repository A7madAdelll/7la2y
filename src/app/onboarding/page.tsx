import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "محل جديد — حلاقي", robots: { index: false } };

/** First step for a new shop owner (login required by proxy.ts). */
export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-5 pt-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-bold">أهلاً بيك في حلاقي</h1>
        <p className="text-ink-soft">دقيقة واحدة ومحلك يبقى جاهز.</p>
      </header>
      <OnboardingForm />
    </main>
  );
}
