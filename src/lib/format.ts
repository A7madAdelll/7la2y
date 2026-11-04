const ARABIC_NUMBER = new Intl.NumberFormat("ar-EG-u-nu-latn", { maximumFractionDigits: 2 });

/** "150 ج.م". Null price = owner has not set it yet. */
export function formatEGP(price: number | null | undefined): string {
  if (price === null || price === undefined) return "السعر في المحل";
  return `${ARABIC_NUMBER.format(price)} ج.م`;
}

/** Egyptian Arabic counting: 1 دقيقة, 2 دقيقتين, 3–10 دقايق, 11+ دقيقة. */
export function formatMinutes(minutes: number): string {
  const n = Math.max(0, Math.round(minutes));
  if (n === 0) return "أقل من دقيقة";
  if (n === 1) return "دقيقة";
  if (n === 2) return "دقيقتين";
  if (n <= 10) return `${n} دقايق`;
  return `${n} دقيقة`;
}

/** Same rule for people waiting ahead: 1 شخص, 2 شخصين, 3–10 أشخاص, 11+ شخص. */
export function formatPeople(count: number): string {
  if (count === 0) return "مفيش حد";
  if (count === 1) return "شخص واحد";
  if (count === 2) return "شخصين";
  if (count <= 10) return `${count} أشخاص`;
  return `${count} شخص`;
}

/** "2026-11-30" -> "30/11/2026" (day first, Western digits), safe inside right-to-left text. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `\u2066${Number(d)}/${Number(m)}/${y}\u2069`; // isolate so RTL text never reorders it
}
