// Egyptian mobile: 01 + operator digit (0,1,2,5) + 8 digits. Landlines are not accepted.
export const isEgyptianMobile = (phone: string) => /^01[0125]\d{8}$/.test(phone);

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/**
 * Same rules as private.normalize_phone() in the database: Arabic-Indic and Persian digits,
 * spaces/dashes, and +20 / 0020 prefixes. The database re-validates; this is for instant feedback.
 */
export function normalizeEgyptianPhone(raw: string): string {
  const digits = [...raw]
    .map((ch) => {
      const a = ARABIC_DIGITS.indexOf(ch);
      if (a >= 0) return String(a);
      const p = PERSIAN_DIGITS.indexOf(ch);
      if (p >= 0) return String(p);
      return ch;
    })
    .join("")
    .replace(/\D/g, "");
  if (digits.startsWith("0020")) return "0" + digits.slice(4);
  if (digits.startsWith("20") && digits.length === 12) return "0" + digits.slice(2);
  return digits;
}
