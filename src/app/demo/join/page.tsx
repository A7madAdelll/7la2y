import { ShopHeader } from "@/components/customer/shop-header";
import { sampleShop } from "@/lib/queue/sample";
import { DemoJoin } from "./demo-join";

export default function DemoJoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col">
      <ShopHeader shop={sampleShop} />
      <DemoJoin />
    </main>
  );
}
