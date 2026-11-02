"use client";

import { useState } from "react";
import { TvBoard } from "@/components/tv/tv-board";
import { sampleCounter } from "@/lib/queue/sample";

// The real TV subscribes to live updates in the browser, so it renders client-side too.
export function DemoTv() {
  const [state] = useState(sampleCounter);
  return <TvBoard state={state} />;
}
