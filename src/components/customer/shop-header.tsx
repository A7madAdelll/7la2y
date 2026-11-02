import { formatPeople } from "@/lib/format";
import type { ShopPublic } from "@/lib/queue/types";

export function ShopHeader({ shop }: { shop: ShopPublic }) {
  return (
    <header className="flex flex-col gap-2.5 bg-ink px-5 pt-5 pb-4.5 text-paper">
      <span className="text-[13px] text-[#c9cdd2]">حلاقي</span>
      <h1 className="text-[26px] leading-snug font-bold">{shop.name}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <span className={shop.queue_open ? "rounded-full bg-brand px-2.5 py-1 text-[13px] font-medium text-white" : "rounded-full bg-ink-raised px-2.5 py-1 text-[13px] font-medium"}>
          {shop.queue_open ? "الطابور مفتوح" : "الطابور مقفول"}
        </span>
        {shop.queue_open && (
          <span className="text-sm text-[#e4e6e9]">
            {shop.waiting_count === 0 ? "مفيش حد مستني دلوقتي" : `${formatPeople(shop.waiting_count)} مستنيين دلوقتي`}
          </span>
        )}
      </div>
    </header>
  );
}
