import type { MetadataRoute } from "next";

// Installable app (PWA). No service worker yet: install needs only this + HTTPS,
// and customer alerts go through WhatsApp, not web push.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "حلاقي — طابور الحلاقة",
    short_name: "حلاقي",
    description: "احجز دورك في الحلاق من غير ما تستنى واقف.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f3ee",
    theme_color: "#15202b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
