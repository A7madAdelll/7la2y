import { Suspense } from "react";
import { DemoCounter } from "./demo-counter";

// Time-dependent (code countdown, minutes in chair): rendered per visit, not at build time.
export default function DemoCounterPage() {
  return (
    <Suspense fallback={<p className="p-6 text-ink-soft">بيحمّل…</p>}>
      <DemoCounter />
    </Suspense>
  );
}
