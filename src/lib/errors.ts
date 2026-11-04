// Database error keys (raised via private.fail() in supabase/migrations) -> Egyptian Arabic.
// errors.test.ts fails if a migration raises a key that is missing here.
export const ERROR_MESSAGES = {
  shop_not_found: "المحل ده مش موجود. اتأكد من الـ QR.",
  queue_closed: "الطابور مقفول دلوقتي. اسأل في المحل.",
  bad_code: "الكود غلط أو اتغير. بص على الشاشة في المحل واكتبه تاني.",
  invalid_name: "اكتب اسمك (من حرف لـ 60 حرف).",
  invalid_phone: "رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015",
  already_in_queue: "الرقم ده عنده دور مفتوح في المحل بالفعل.",
  service_required: "اختار الخدمة اللي عايزها.",
  main_service_required: "اختار خدمة أساسية (قصة أو دقن) مع الإضافات.",
  too_many_services: "اخترت خدمات كتير. قلل شوية.",
  invalid_service: "في خدمة مش متاحة دلوقتي. حدّث الصفحة.",
  invalid_barber: "الحلاق ده مش موجود النهارده. اختار حد تاني أو «أي حلاق».",
  forbidden: "مش مسموحلك تعمل ده.",
  not_active: "الزبون ده مش في الدور دلوقتي.",
  not_waiting: "الزبون ده مش مستني دلوقتي.",
  invalid_target: "الترتيب اتغير. حدّث الشاشة وجرب تاني.",
  invalid_transition: "الحالة دي اتغيرت بالفعل. حدّث الشاشة.",
  slug_taken: "اسم الرابط ده مستخدم. جرب اسم تاني.",
  invalid_shop: "بيانات المحل مش صح.",
  rate_limited: "محاولات كتير ورا بعض. استنى 10 دقايق وجرب تاني.",
  invalid_client: "حصلت مشكلة. جرب تاني بعد شوية.",
  invalid_request: "في حاجة ناقصة في البيانات. حدّث الصفحة وجرب تاني.",
  bot_check_failed: "معرفناش نتأكد إنك مش روبوت. حدّث الصفحة وجرب تاني.",
} as const;

export type ErrorKey = keyof typeof ERROR_MESSAGES;

const FALLBACK = "حصلت مشكلة. جرب تاني بعد شوية.";

/** Turns a database/API error into a message safe to show a customer. Never leaks raw errors. */
export function errorMessage(err: unknown): string {
  const key =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  return key in ERROR_MESSAGES ? ERROR_MESSAGES[key as ErrorKey] : FALLBACK;
}
