import { Suspense } from "react";
import { DemoTv } from "./demo-tv";

export default function DemoTvPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <DemoTv />
    </Suspense>
  );
}
