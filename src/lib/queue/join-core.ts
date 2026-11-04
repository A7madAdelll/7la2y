import { ERROR_MESSAGES } from "@/lib/errors";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { validateJoin } from "./join-validation";
import type { JoinInput, PublicService } from "./types";

export type JoinOutcome = { ok: true; token: string; ticketNo: number } | { ok: false; error: string };

export type JoinDeps = {
  verifyBot: (token: string, ip: string) => Promise<boolean>;
  /** Calls public.join_queue as service_role. Returns its JSON or throws the DB error. */
  callJoin: (args: {
    p_client_key: string; p_slug: string; p_code: string; p_name: string; p_phone: string;
    p_barber_id: string | null; p_service_ids: string[]; p_wants_alert: boolean;
  }) => Promise<{ token?: string; ticket_no?: number; error?: string }>;
};

/**
 * Server side of "احجز دوري": bot check, input shape check, then one DB call that enforces
 * every real rule (code, limits, one active entry...). Never trusts the browser.
 */
export async function performJoin(
  req: { slug: string; input: JoinInput; botToken: string; ip: string; services?: PublicService[] },
  deps: JoinDeps,
): Promise<JoinOutcome> {
  const { input } = req;
  if (
    typeof input?.name !== "string" || typeof input.phone !== "string" || typeof input.code !== "string" ||
    !Array.isArray(input.serviceIds) || input.serviceIds.length > 10 ||
    !input.serviceIds.every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) ||
    (input.barberId !== null && (typeof input.barberId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.barberId))) ||
    !/^[a-z0-9-]{3,40}$/.test(req.slug)
  ) {
    return { ok: false, error: "invalid_request" };
  }
  if (req.services) {
    const errs = validateJoin(input, req.services);
    const first = Object.values(errs)[0];
    if (first) return { ok: false, error: first };
  }
  if (!(await deps.verifyBot(req.botToken, req.ip))) return { ok: false, error: "bot_check_failed" };

  try {
    const r = await deps.callJoin({
      p_client_key: req.ip,
      p_slug: req.slug,
      p_code: normalizeEgyptianPhone(input.code), // same digit normalisation (Arabic-Indic -> 0-9)
      p_name: input.name,
      p_phone: input.phone,
      p_barber_id: input.barberId,
      p_service_ids: input.serviceIds,
      p_wants_alert: input.wantsAlert === true,
    });
    if (r.error) return { ok: false, error: r.error };
    if (!r.token || !r.ticket_no) return { ok: false, error: "unknown" };
    return { ok: true, token: r.token, ticketNo: r.ticket_no };
  } catch (e) {
    const key = e instanceof Error ? e.message : "";
    if (key in ERROR_MESSAGES) return { ok: false, error: key };
    // Unexpected: log for us, never send internals to the browser.
    console.error("join_queue failed", e);
    return { ok: false, error: "unknown" };
  }
}
