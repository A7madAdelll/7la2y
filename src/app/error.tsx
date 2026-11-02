"use client";

import { Button, Notice } from "@/components/ui";

// Friendly fallback for unexpected errors (e.g. database unreachable). No internals shown.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
      <Notice tone="error">حصلت مشكلة. جرب تاني بعد شوية.</Notice>
      <Button onClick={reset}>جرب تاني</Button>
    </main>
  );
}
