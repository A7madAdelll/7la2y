"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Notice, TextField } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const linkError = params.get("error") === "link";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setState("error");
    setState("sending");
    const next = safeNext(params.get("next"));
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return <Notice>بعتنالك لينك على {email.trim()}. افتحه من نفس الموبايل عشان تدخل.</Notice>;
  }
  return (
    <form noValidate onSubmit={send} className="flex flex-col gap-4">
      {linkError && <Notice tone="error">اللينك ده انتهى أو اتستخدم قبل كده. اطلب لينك جديد.</Notice>}
      <TextField label="الإيميل" type="email" dir="ltr" className="text-right" autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)}
        error={state === "error" ? "اكتب إيميل صحيح وجرب تاني." : undefined} />
      <Button type="submit" block disabled={state === "sending"}>{state === "sending" ? "لحظة…" : "ابعتلي لينك الدخول"}</Button>
    </form>
  );
}
