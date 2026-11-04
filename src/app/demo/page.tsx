import Link from "next/link";

const SCREENS = [
  ["/demo/join", "العميل: الدخول للدور"],
  ["/demo/status", "العميل: دورك"],
  ["/demo/counter", "الكاشير: شاشة التحكم"],
  ["/demo/tv", "شاشة التلفزيون"],
  ["/demo/poster", "بوستر الـ QR للطباعة"],
  ["/demo/admin", "لوحة الإدارة"],
  ["/ui-kit", "مكونات التصميم"],
] as const;

export default function DemoIndex() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 p-5">
      <h1 className="text-2xl font-bold">شاشات حلاقي</h1>
      {SCREENS.map(([href, label]) => (
        <Link key={href} href={href} className="flex min-h-13 items-center rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface px-4 font-medium text-ink hover:border-ink">
          {label}
        </Link>
      ))}
    </main>
  );
}
