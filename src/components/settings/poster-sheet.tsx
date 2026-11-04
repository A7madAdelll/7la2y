import { Qr } from "@/components/ui";
import { PrintButton } from "./print-button";

/** A5 portrait poster: shop name, QR code, four steps. Printed from the browser. */
export function PosterSheet({ name, url, svg }: { name: string; url: string; svg: string }) {
  return (
    <>
      <div className="no-print flex justify-center gap-3 p-4">
        <PrintButton />
      </div>
      <article className="poster-sheet mx-auto flex h-[210mm] print:h-[209mm] print:overflow-hidden w-[148mm] flex-col items-center justify-between bg-white px-[12mm] py-[14mm] text-center text-ink shadow-sm print:shadow-none">
        <header className="flex flex-col gap-2">
          <h1 className="text-[30px] leading-tight font-bold">{name}</h1>
          <p className="text-[22px] font-bold text-brand">احجز دورك من موبايلك</p>
        </header>
        <Qr svg={svg} label={`QR لرابط ${url}`} className="w-[78mm]" />
        <ol className="flex w-full flex-col gap-2 text-start text-[16px] leading-snug">
          <li><b>1.</b> صوّر الكود ده بكاميرا الموبايل</li>
          <li><b>2.</b> اكتب اسمك ورقمك واختار الخدمة</li>
          <li><b>3.</b> اكتب كود المحل اللي على الشاشة</li>
          <li><b>4.</b> استنى براحتك، وهنبعتلك واتساب لو حبيت</li>
        </ol>
        <footer className="flex w-full items-center justify-between text-[12px] text-ink-soft">
          <span dir="ltr">{url.replace(/^https?:\/\//, "")}</span>
          <span>حلاقي</span>
        </footer>
      </article>
    </>
  );
}
