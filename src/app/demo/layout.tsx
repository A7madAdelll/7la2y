import type { Metadata } from "next";

// /demo/* = the real screens on sample data, until Supabase staging is connected. Never indexed.
export const metadata: Metadata = { robots: { index: false } };

export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return (
    <>
      <p role="note" className="no-print bg-warn-tint px-4 py-1.5 text-center text-[13px] text-warn">نسخة تجريبية ببيانات وهمية</p>
      {children}
    </>
  );
}
