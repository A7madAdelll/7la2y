import { isEgyptianMobile, normalizeEgyptianPhone } from "@/lib/phone";
import type { ErrorKey } from "@/lib/errors";
import type { JoinInput, PublicService } from "./types";

export type JoinFieldErrors = Partial<Record<"name" | "phone" | "code" | "services", ErrorKey>>;

/**
 * Instant feedback in the browser, with the same rules the database enforces.
 * The database still re-validates everything; this only saves a round trip.
 */
export function validateJoin(input: JoinInput, services: PublicService[]): JoinFieldErrors {
  const errors: JoinFieldErrors = {};
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) errors.name = "invalid_name";
  if (!isEgyptianMobile(normalizeEgyptianPhone(input.phone))) errors.phone = "invalid_phone";
  if (!/^\d{4}$/.test(normalizeEgyptianPhone(input.code))) errors.code = "bad_code";

  const chosen = services.filter((s) => input.serviceIds.includes(s.id));
  if (chosen.length === 0) errors.services = "service_required";
  else if (chosen.length > 10) errors.services = "too_many_services";
  else if (!chosen.some((s) => s.kind !== "extra")) errors.services = "main_service_required";
  return errors;
}

/** Sum of the chosen services' minutes and prices (price null if any price is unset). */
export function summarize(serviceIds: string[], services: PublicService[]) {
  const chosen = services.filter((s) => serviceIds.includes(s.id));
  const minutes = chosen.reduce((a, s) => a + s.minutes, 0);
  const price = chosen.some((s) => s.price_egp === null)
    ? null
    : chosen.reduce((a, s) => a + (s.price_egp ?? 0), 0);
  return { minutes, price, count: chosen.length };
}
