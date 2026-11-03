"use client";

import { useState } from "react";
import { EntryStatusView } from "@/components/customer/entry-status-view";
import { Button } from "@/components/ui";
import { sampleStatus } from "@/lib/queue/sample";

export function DemoStatus() {
  const [status, setStatus] = useState(sampleStatus);
  return (
    <>
      <EntryStatusView
        status={status}
        onLeave={async () => setStatus((s) => ({ ...s, status: "left" }))}
        onForget={async () => setStatus((s) => ({ ...s, status: "left" }))}
        onConfirmWhatsApp={async () => setStatus((s) => ({ ...s, whatsapp_confirmed: true }))}
      />
      {status.status === "waiting" && (
        <div className="no-print px-5 pb-6">
          <Button variant="secondary" size="md" block
            onClick={() => setStatus((s) => ({ ...s, status: "serving", barber_name: "محمد", ahead: null, estimated_minutes: null }))}>
            تجربة: اتنده عليا
          </Button>
        </div>
      )}
    </>
  );
}
