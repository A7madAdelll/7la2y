"use client";

import { useState } from "react";
import { TvBoard } from "@/components/tv/tv-board";
import { sampleCounter } from "@/lib/queue/sample";
import { tvFromCounter } from "@/lib/queue/tv-from-counter";

// The real TV subscribes to live updates in the browser, so it renders client-side too.
export function DemoTv() {
  const [data] = useState(() => tvFromCounter(sampleCounter()));
  return <TvBoard data={data} />;
}
