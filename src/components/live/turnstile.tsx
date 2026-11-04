"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("turnstile_load_failed")); };
    document.head.appendChild(s);
  });
  return loading;
}

export type TurnstileHandle = { reset: () => void };

/** Cloudflare Turnstile bot check. Invisible for most visitors; tokens are single-use. */
export const Turnstile = forwardRef<TurnstileHandle, { siteKey: string; onToken: (t: string) => void }>(
  function Turnstile({ siteKey, onToken }, ref) {
    const el = useRef<HTMLDivElement>(null);
    const id = useRef<string | null>(null);
    const cb = useRef(onToken);
    useEffect(() => { cb.current = onToken; }, [onToken]);

    useImperativeHandle(ref, () => ({
      reset: () => { if (id.current && window.turnstile) { cb.current(""); window.turnstile.reset(id.current); } },
    }));

    useEffect(() => {
      let cancelled = false;
      loadScript()
        .then(() => {
          if (cancelled || !el.current || !window.turnstile) return;
          id.current = window.turnstile.render(el.current, {
            sitekey: siteKey,
            language: "ar",
            appearance: "interaction-only",
            callback: (t: string) => cb.current(t),
            "expired-callback": () => cb.current(""),
            "error-callback": () => cb.current(""),
          });
        })
        .catch(() => cb.current(""));
      return () => {
        cancelled = true;
        if (id.current && window.turnstile) window.turnstile.remove(id.current);
      };
    }, [siteKey]);

    return <div ref={el} className="flex justify-center empty:hidden" />;
  },
);
