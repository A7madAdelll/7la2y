/** Usage pricing decided by Ahmad (4 Nov 2026): 1 EGP per finished haircut. */
export const PRICE_PER_HAIRCUT_EGP = 1;

export const amountDue = (haircuts: number) => Math.max(0, Math.round(haircuts)) * PRICE_PER_HAIRCUT_EGP;

/** Invoice message the admin sends by hand (WhatsApp). Payment details are added by the admin. */
export function invoiceText(shopName: string, haircuts: number) {
  return [
    `أهلاً، فاتورة حلاقي لمحل ${shopName}:`,
    `${haircuts} حلاقة خلصت الشهر ده × ${PRICE_PER_HAIRCUT_EGP} ج.م`,
    `المستحق: ${amountDue(haircuts)} ج.م`,
    "ابعت المبلغ على InstaPay أو Vodafone Cash وابعتلي صورة التحويل.",
  ].join("\n");
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
