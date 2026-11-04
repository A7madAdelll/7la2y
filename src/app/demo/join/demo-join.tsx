"use client";

import { useRouter } from "next/navigation";
import { JoinForm } from "@/components/customer/join-form";
import { sampleShop } from "@/lib/queue/sample";

export function DemoJoin() {
  const router = useRouter();
  return (
    <JoinForm
      shop={sampleShop}
      onJoin={async (input) => {
        // Demo: only "4827" works, like a real rotating code would reject a wrong one.
        await new Promise((r) => setTimeout(r, 400));
        if (input.code.replace(/\D/g, "") !== "4827" && input.code !== "٤٨٢٧") throw new Error("bad_code");
        router.push("/demo/status");
      }}
    />
  );
}
