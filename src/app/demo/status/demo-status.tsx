"use client";

import { useState } from "react";
import { EntryStatusView } from "@/components/customer/entry-status-view";
import { sampleStatus } from "@/lib/queue/sample";

export function DemoStatus() {
  const [status, setStatus] = useState(sampleStatus);
  return <EntryStatusView status={status} onLeave={async () => setStatus((s) => ({ ...s, status: "left" }))}
    onForget={async () => setStatus((s) => ({ ...s, status: "left" }))} />;
}
