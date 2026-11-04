import { PosterSheet } from "@/components/settings/poster-sheet";
import { qrSvg } from "@/lib/qr";
import { sampleShop } from "@/lib/queue/sample";

export default async function DemoPosterPage() {
  const url = "https://example.com/salon-el-nil";
  return <PosterSheet name={sampleShop.name} url={url} svg={await qrSvg(url)} />;
}
