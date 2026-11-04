import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "دخول أصحاب المحلات — حلاقي", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-5 pt-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-bold">دخول المحل</h1>
        <p className="text-ink-soft">لصاحب المحل والكاشير. هنبعتلك لينك على الإيميل، من غير باسورد.</p>
      </header>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
