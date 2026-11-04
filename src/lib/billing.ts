/** Usage pricing decided by Ahmad (4 Nov 2026): 1 EGP per finished haircut. */
export const PRICE_PER_HAIRCUT_EGP = 1;

export const amountDue = (haircuts: number) => Math.max(0, Math.round(haircuts)) * PRICE_PER_HAIRCUT_EGP;
