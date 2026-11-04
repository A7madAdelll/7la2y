import { sampleStatus } from "@/lib/queue/sample";
import { DemoStatus } from "./demo-status";

export default function DemoStatusPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-4.5">
        <span className="font-bold">{sampleStatus.shop_name}</span>
        <span className="flex items-center gap-1.5 text-[13px] text-ink-soft">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" /> مباشر
        </span>
      </header>
      <DemoStatus />
    </main>
  );
}
