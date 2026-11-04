import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "حلاقي — طابور الحلاقة",
  description: "احجز دورك في الحلاق من غير ما تستنى واقف.",
  appleWebApp: { capable: true, title: "حلاقي", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#15202b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
