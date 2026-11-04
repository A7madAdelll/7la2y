import { Notice } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
      <Notice>الصفحة دي مش موجودة. لو جيت من QR المحل، امسحه تاني.</Notice>
    </main>
  );
}
