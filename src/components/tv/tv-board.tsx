import type { TvData } from "@/lib/queue/types";

/** Waiting-room TV: read-only, large type, readable from across the shop. No customer names. */
export function TvBoard({ data, qr }: { data: TvData; qr?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-3 gap-8 bg-ink px-12 py-9 text-paper">
      <section className="col-span-2 flex flex-col gap-6">
        <h1 className="text-[34px] font-bold">{data.shop_name}</h1>
        <div className="grid grid-cols-2 gap-5">
          {data.barbers.map((b) => (
            <div key={b.name} className="flex flex-col gap-1.5 rounded-3xl bg-ink-raised px-7 py-6">
              <span className="text-[22px] text-[#c9cdd2]">عند {b.name}</span>
              <span className="text-[120px] leading-none font-bold tabular-nums">{b.serving_ticket ?? "—"}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-medium text-[#c9cdd2]">الدور الجاي</h2>
          <ol className="flex flex-wrap gap-3.5">
            {data.next.map((n, i) => (
              <li key={n} className={i < 2 ? "rounded-2xl bg-paper px-6.5 py-1.5 text-[40px] font-bold text-ink tabular-nums" : "rounded-2xl bg-[#2e3d4b] px-6.5 py-1.5 text-[40px] font-bold tabular-nums"}>
                {n}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <aside className="flex flex-col items-center justify-center gap-4 rounded-[28px] bg-paper p-7 text-center text-ink">
        {data.queue_open ? (
          <>
            <span className="text-[26px] font-bold">احجز دورك من موبايلك</span>
            {qr ?? <div className="grid size-[220px] place-items-center rounded-2xl border-[3px] border-dashed border-[#8a9097] text-lg text-ink-soft">مكان كود الـ QR</div>}
            <span className="text-xl text-ink-soft">واكتب الكود ده</span>
            <span dir="ltr" className="text-[72px] leading-none font-bold tracking-[10px] tabular-nums">{data.code}</span>
            <span className="text-base text-ink-soft">الكود بيتغير كل 5 دقايق</span>
          </>
        ) : (
          <span className="text-[32px] font-bold">الطابور مقفول دلوقتي</span>
        )}
      </aside>
    </div>
  );
}
